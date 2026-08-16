import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { activeSlugAliasExists } from "@/lib/link-aliases";
import { primeLinkMetadataCache } from "@/lib/link-cache";
import { isValidSlug, validateDestinationUrl } from "@/lib/links";
import { noStoreJson } from "@/lib/no-store";
import { ensureDefaultPagePresets, isPagePresetKey } from "@/lib/page-presets";
import { prisma } from "@/lib/prisma";
import { assignedDomainAccessWhere, getTenantAccess, linkAccessWhere } from "@/lib/tenant-access";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse("Unauthenticated", { status: 401 });
  }

  const access = await getTenantAccess(session.user.id);

  if (!access.allowed) {
    return noStoreJson({ error: access.reason }, { status: 403 });
  }

  const links = await prisma.link.findMany({
    where: {
      userId: session.user.id,
      ...linkAccessWhere(),
    },
    orderBy: { createdAt: "desc" },
    include: {
      domain: {
        select: {
          hostString: true,
          status: true,
        },
      },
      _count: {
        select: {
          clicks: true,
        },
      },
      slugAliases: {
        where: {
          expiresAt: {
            gt: new Date(),
          },
        },
        orderBy: { expiresAt: "desc" },
        select: {
          id: true,
          slug: true,
          expiresAt: true,
        },
      },
    },
  });

  return noStoreJson(links);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse("Unauthenticated", { status: 401 });
  }

  const access = await getTenantAccess(session.user.id);

  if (!access.allowed) {
    return noStoreJson({ error: access.reason }, { status: 403 });
  }

  const payload = (await req.json()) as {
    slug?: string;
    destinationUrl?: string;
    domainId?: string;
    indexPagePreset?: string;
  };
  const { slug, destinationUrl, domainId } = payload;
  const indexPagePreset = payload.indexPagePreset && isPagePresetKey(payload.indexPagePreset) ? payload.indexPagePreset : "minimal";

  if (!slug || !destinationUrl || !domainId || !isValidSlug(slug)) {
    return noStoreJson({ error: "A valid domain, slug, and destination URL are required." }, { status: 400 });
  }

  let parsedDestination: string;

  try {
    parsedDestination = validateDestinationUrl(destinationUrl);
  } catch (error) {
    return noStoreJson({ error: error instanceof Error ? error.message : "Invalid destination URL." }, { status: 400 });
  }

  const tenant = await prisma.user.findFirst({
    where: {
      id: session.user.id,
      ...assignedDomainAccessWhere(),
    },
    select: {
      assignedDomainId: true,
    },
  });

  if (!tenant?.assignedDomainId) {
    return noStoreJson({ error: "No domain has been assigned to this workspace yet." }, { status: 400 });
  }

  if (tenant.assignedDomainId !== domainId) {
    return noStoreJson({ error: "Links must use your assigned workspace domain." }, { status: 403 });
  }

  const domain = await prisma.domain.findFirst({
    where: {
      id: domainId,
      status: "ACTIVE",
    },
  });

  if (!domain) {
    return noStoreJson({ error: "Domain missing context" }, { status: 400 });
  }

  if (await activeSlugAliasExists(domain.id, slug)) {
    return noStoreJson({ error: "That slug is reserved by a recently rotated URL." }, { status: 409 });
  }

  await ensureDefaultPagePresets();

  try {
    const link = await prisma.link.create({
      data: {
        slug,
        destinationUrl: parsedDestination,
        indexPagePreset,
        domainId: domain.id,
        userId: session.user.id,
      },
      include: {
        domain: {
          select: {
            hostString: true,
            status: true,
          },
        },
      },
    });

    try {
      await primeLinkMetadataCache({
        linkId: link.id,
        host: domain.hostString,
        slug,
        canonicalSlug: slug,
        destinationUrl: parsedDestination,
        indexPagePreset: link.indexPagePreset,
        redirectSource: link.redirectSource,
        expiresAt: link.expiresAt?.toISOString() ?? null,
        status: link.status,
      });
    } catch {
      // The database write is the source of truth; cache priming can be retried on first redirect.
    }

    return noStoreJson(link, { status: 201 });
  } catch {
    return noStoreJson({ error: "Slug collision occurred" }, { status: 409 });
  }
}
