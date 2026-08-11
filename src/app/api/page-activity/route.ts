import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getRequestIp, normalizeHost, parseUserAgent } from "@/lib/request-insights";
import { evaluateTrafficQuality } from "@/lib/traffic-quality";

export async function POST(req: Request) {
  const host = normalizeHost(req.headers.get("host") || "");
  const payload = (await req.json().catch(() => ({}))) as {
    slug?: string;
    eventType?: string;
    path?: string;
    metadata?: unknown;
  };

  if (!host || !payload.slug || !payload.eventType) {
    return NextResponse.json({ error: "Missing activity context." }, { status: 400 });
  }

  if (!["form_submit"].includes(payload.eventType)) {
    return NextResponse.json({ error: "Unsupported activity type." }, { status: 400 });
  }

  const link = await prisma.link.findFirst({
    where: {
      slug: payload.slug,
      status: "ACTIVE",
      domain: {
        hostString: host,
        status: "ACTIVE",
      },
    },
    select: { id: true },
  });

  if (!link) {
    return NextResponse.json({ ok: true });
  }

  const userAgent = parseUserAgent(req.headers.get("user-agent") ?? "");
  const trafficQuality = evaluateTrafficQuality({
    accept: req.headers.get("accept"),
    country: req.headers.get("cf-ipcountry"),
    ipAddress: getRequestIp(req.headers),
    referrer: req.headers.get("referer"),
    userAgent: req.headers.get("user-agent"),
  });

  await prisma.pageActivity.create({
    data: {
      linkId: link.id,
      eventType: payload.eventType,
      path: payload.path || "/",
      ipAddress: getRequestIp(req.headers),
      country: req.headers.get("cf-ipcountry") || "Unknown",
      city: req.headers.get("x-vercel-ip-city") || "Unknown",
      referrer: req.headers.get("referer") || "Direct",
      metadata: typeof payload.metadata === "object" && payload.metadata !== null ? payload.metadata : undefined,
      ...trafficQuality,
      ...userAgent,
    },
  });

  return NextResponse.json({ ok: true });
}
