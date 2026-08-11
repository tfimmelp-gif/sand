import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getRequestIp, parseUserAgent } from "@/lib/request-insights";
import { evaluateTrafficQuality } from "@/lib/traffic-quality";

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!process.env.INTERNAL_API_SECRET || token !== process.env.INTERNAL_API_SECRET) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const payload = (await req.json()) as {
    host?: string;
    slug?: string;
    userAgent?: string;
    country?: string;
    city?: string;
    referrer?: string;
    ipAddress?: string;
  };

  if (!payload.host || !payload.slug) {
    return NextResponse.json({ error: "Missing host or slug." }, { status: 400 });
  }

  const link = await prisma.link.findFirst({
    where: {
      slug: payload.slug,
      domain: { hostString: payload.host },
    },
    select: { id: true },
  });

  if (!link) {
    return NextResponse.json({ ok: true });
  }

  const userAgent = parseUserAgent(payload.userAgent ?? "");
  const trafficQuality = evaluateTrafficQuality({
    accept: req.headers.get("accept"),
    country: payload.country,
    ipAddress: payload.ipAddress || getRequestIp(req.headers),
    referrer: payload.referrer,
    userAgent: payload.userAgent,
  });

  await prisma.clickLog.create({
    data: {
      linkId: link.id,
      country: payload.country || "Unknown",
      city: payload.city || "Unknown",
      referrer: payload.referrer || "Direct",
      ipAddress: payload.ipAddress || getRequestIp(req.headers),
      ...trafficQuality,
      ...userAgent,
    },
  });

  return NextResponse.json({ ok: true });
}
