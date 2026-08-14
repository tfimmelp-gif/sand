import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { parseExpiryInput } from "@/lib/expiration";
import { activeSlugAliasExists } from "@/lib/link-aliases";
import { isValidSlug, validateDestinationUrl } from "@/lib/links";
import { noStoreJson } from "@/lib/no-store";
import { ensureDefaultPagePresets, isPagePresetKey } from "@/lib/page-presets";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "SUPER_ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const links = await prisma.link.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
      domain: {
        select: {
          id: true,
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

  if (!session || session.user.role !== "SUPER_ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { userId, domainId, slug, destinationUrl, indexPagePreset, redirectSource, expiresAt, expiryBundle } = (await req.json()) as {
    userId?: string;
    domainId?: string;
    slug?: string;
    destinationUrl?: string;
    indexPagePreset?: string;
    redirectSource?: "ADMIN_DESTINATION" | "PRESET_CONTROLLED";
    expiresAt?: string | null;
    expiryBundle?: string | null;
  };
  const selectedPreset = indexPagePreset && isPagePresetKey(indexPagePreset) ? indexPagePreset : "minimal";
  const selectedRedirectSource = redirectSource === "PRESET_CONTROLLED" ? "PRESET_CONTROLLED" : "ADMIN_DESTINATION";

  if (!userId || !domainId || !slug || !destinationUrl || !isValidSlug(slug)) {
    return noStoreJson({ error: "Tenant, domain, slug, and destination URL are required." }, { status: 400 });
  }

  let parsedDestination: string;

  try {
    parsedDestination = validateDestinationUrl(destinationUrl);
  } catch (error) {
    return noStoreJson({ error: error instanceof Error ? error.message : "Invalid destination URL." }, { status: 400 });
  }

  const [tenant, domain] = await Promise.all([
    prisma.user.findFirst({
      where: {
        id: userId,
        role: "WORKSPACE_USER",
      },
      select: { id: true, assignedDomainId: true },
    }),
    prisma.domain.findFirst({
      where: {
        id: domainId,
        status: "ACTIVE",
        OR: [{ isGlobal: true }, { userId }],
      },
    }),
  ]);

  if (!tenant) {
    return noStoreJson({ error: "Tenant user was not found." }, { status: 404 });
  }

  if (!domain) {
    return noStoreJson({ error: "Domain is not available to this tenant." }, { status: 400 });
  }

  if (!tenant.assignedDomainId) {
    return noStoreJson({ error: "Assign an active domain to this tenant before creating links." }, { status: 400 });
  }

  if (tenant.assignedDomainId !== domain.id) {
    return noStoreJson({ error: "This tenant is assigned to a different domain." }, { status: 403 });
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
        indexPagePreset: selectedPreset,
        redirectSource: selectedRedirectSource,
        expiresAt: parseExpiryInput({ expiresAt, expiryBundle }),
        domainId: domain.id,
        userId: tenant.id,
      },
      include: {
        user: { select: { id: true, email: true } },
        domain: { select: { id: true, hostString: true, status: true } },
      },
    });

    try {
      await redis.set(`link:${domain.hostString}:${slug}`, parsedDestination, { ex: 60 * 60 * 24 });
    } catch {
      // Cache is best-effort; DB remains source of truth.
    }

    return noStoreJson(link, { status: 201 });
  } catch {
    return noStoreJson({ error: "Slug already exists for that domain." }, { status: 409 });
  }
}
