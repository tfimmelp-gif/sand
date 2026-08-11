import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { publicLinkAccessWhere } from "@/lib/tenant-access";

function normalizeSlug(slug: string) {
  return slug
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\/index\.html$/i, "");
}

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!process.env.INTERNAL_API_SECRET || token !== process.env.INTERNAL_API_SECRET) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { host, slug } = (await req.json()) as {
    host?: string;
    slug?: string;
  };

  const normalizedSlug = slug ? normalizeSlug(slug) : "";

  if (!host || !normalizedSlug) {
    return NextResponse.json({ error: "Missing host or slug." }, { status: 400 });
  }

  const link = await prisma.link.findFirst({
    where: {
      slug: normalizedSlug,
      ...publicLinkAccessWhere(host),
    },
    select: {
      destinationUrl: true,
    },
  });

  if (!link) {
    return NextResponse.json({ found: false }, { status: 404 });
  }

  try {
    await redis.set(`link:${host}:${normalizedSlug}`, link.destinationUrl, { ex: 60 * 60 * 24 });
  } catch {
    // Redirect correctness should not depend on cache write availability.
  }

  return NextResponse.json({
    found: true,
    destinationUrl: link.destinationUrl,
  });
}
