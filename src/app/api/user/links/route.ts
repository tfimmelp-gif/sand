import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { isValidSlug, validateDestinationUrl } from "@/lib/links";
import { ensureDefaultPagePresets, isPagePresetKey } from "@/lib/page-presets";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse("Unauthenticated", { status: 401 });
  }

  const links = await prisma.link.findMany({
    where: { userId: session.user.id },
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
    },
  });

  return NextResponse.json(links);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse("Unauthenticated", { status: 401 });
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
    return NextResponse.json({ error: "A valid domain, slug, and destination URL are required." }, { status: 400 });
  }

  let parsedDestination: string;

  try {
    parsedDestination = validateDestinationUrl(destinationUrl);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid destination URL." }, { status: 400 });
  }

  const tenant = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      assignedDomainId: true,
    },
  });

  if (!tenant?.assignedDomainId) {
    return NextResponse.json({ error: "No domain has been assigned to this workspace yet." }, { status: 400 });
  }

  if (tenant.assignedDomainId !== domainId) {
    return NextResponse.json({ error: "Links must use your assigned workspace domain." }, { status: 403 });
  }

  const domain = await prisma.domain.findFirst({
    where: {
      id: domainId,
      status: "ACTIVE",
    },
  });

  if (!domain) {
    return NextResponse.json({ error: "Domain missing context" }, { status: 400 });
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
      await redis.set(`link:${domain.hostString}:${slug}`, parsedDestination, { ex: 60 * 60 * 24 });
    } catch {
      // The database write is the source of truth; cache priming can be retried on first redirect.
    }

    return NextResponse.json(link, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Slug collision occurred" }, { status: 409 });
  }
}
