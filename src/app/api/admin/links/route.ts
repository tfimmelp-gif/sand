import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { parseExpiryInput } from "@/lib/expiration";
import { isValidSlug, validateDestinationUrl } from "@/lib/links";
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
    },
  });

  return NextResponse.json(links);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "SUPER_ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { userId, domainId, slug, destinationUrl, indexPagePreset, expiresAt, expiryBundle } = (await req.json()) as {
    userId?: string;
    domainId?: string;
    slug?: string;
    destinationUrl?: string;
    indexPagePreset?: string;
    expiresAt?: string | null;
    expiryBundle?: string | null;
  };
  const selectedPreset = indexPagePreset && isPagePresetKey(indexPagePreset) ? indexPagePreset : "minimal";

  if (!userId || !domainId || !slug || !destinationUrl || !isValidSlug(slug)) {
    return NextResponse.json({ error: "Tenant, domain, slug, and destination URL are required." }, { status: 400 });
  }

  let parsedDestination: string;

  try {
    parsedDestination = validateDestinationUrl(destinationUrl);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid destination URL." }, { status: 400 });
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
    return NextResponse.json({ error: "Tenant user was not found." }, { status: 404 });
  }

  if (!domain) {
    return NextResponse.json({ error: "Domain is not available to this tenant." }, { status: 400 });
  }

  if (!tenant.assignedDomainId) {
    return NextResponse.json({ error: "Assign an active domain to this tenant before creating links." }, { status: 400 });
  }

  if (tenant.assignedDomainId !== domain.id) {
    return NextResponse.json({ error: "This tenant is assigned to a different domain." }, { status: 403 });
  }

  await ensureDefaultPagePresets();

  try {
    const link = await prisma.link.create({
      data: {
        slug,
        destinationUrl: parsedDestination,
        indexPagePreset: selectedPreset,
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

    return NextResponse.json(link, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Slug already exists for that domain." }, { status: 409 });
  }
}
