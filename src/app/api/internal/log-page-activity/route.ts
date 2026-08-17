import { NextResponse } from "next/server";

import { enqueueAnalyticsEvent } from "@/lib/analytics-queue";
import { getRequestIp, parseUserAgent } from "@/lib/request-insights";
import { resolvePublicLinkMetadata } from "@/lib/public-link";
import { evaluateTrafficQuality } from "@/lib/traffic-quality";

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!process.env.INTERNAL_API_SECRET || token !== process.env.INTERNAL_API_SECRET) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const payload = (await req.json()) as {
    host?: string;
    slug?: string;
    eventType?: string;
    path?: string;
    userAgent?: string;
    country?: string;
    city?: string;
    referrer?: string;
    ipAddress?: string;
    metadata?: unknown;
  };

  if (!payload.host || !payload.slug || !payload.eventType) {
    return NextResponse.json({ error: "Missing activity context." }, { status: 400 });
  }

  const link = await resolvePublicLinkMetadata(payload.host, payload.slug);

  if (!link) {
    console.warn("log-page-activity unresolved link", { host: payload.host, slug: payload.slug, eventType: payload.eventType });
    return NextResponse.json({ ok: true, recorded: false, reason: "link_not_found" });
  }

  const userAgent = parseUserAgent(payload.userAgent ?? "");
  const trafficQuality = evaluateTrafficQuality({
    accept: req.headers.get("accept"),
    country: payload.country,
    ipAddress: payload.ipAddress || getRequestIp(req.headers),
    referrer: payload.referrer,
    userAgent: payload.userAgent,
  });

  try {
    await enqueueAnalyticsEvent({
      kind: "page_activity",
      linkId: link.linkId,
      host: payload.host,
      slug: payload.slug,
      eventType: payload.eventType,
      path: payload.path || "/",
      ipAddress: payload.ipAddress || getRequestIp(req.headers),
      country: payload.country || "Unknown",
      city: payload.city || "Unknown",
      referrer: payload.referrer || "Direct",
      metadata: payload.metadata,
      userAgent: payload.userAgent,
      ...trafficQuality,
      ...userAgent,
    });
  } catch (error) {
    console.error("log-page-activity record failed", error);
    return NextResponse.json({ error: "Unable to record activity." }, { status: 500 });
  }

  if (process.env.ANALYTICS_DEBUG === "true") {
    console.info("log-page-activity recorded", {
      host: payload.host,
      slug: payload.slug,
      eventType: payload.eventType,
      linkId: link.linkId,
    });
  }

  return NextResponse.json({ ok: true, recorded: true });
}
