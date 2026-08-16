import { NextResponse } from "next/server";

import { enqueueAnalyticsEvent } from "@/lib/analytics-queue";
import { resolvePublicLinkMetadata } from "@/lib/public-link";
import { getRequestIp, normalizeHost, parseUserAgent } from "@/lib/request-insights";
import { evaluateTrafficQuality } from "@/lib/traffic-quality";

export async function POST(req: Request) {
  const payload = (await req.json().catch(() => ({}))) as {
    host?: string;
    slug?: string;
    eventType?: string;
    path?: string;
    metadata?: unknown;
  };
  const host = normalizeHost(payload.host || req.headers.get("host") || "");

  if (!host || !payload.slug || !payload.eventType) {
    return corsJson({ error: "Missing activity context." }, { status: 400 });
  }

  if (!["form_submit"].includes(payload.eventType)) {
    return corsJson({ error: "Unsupported activity type." }, { status: 400 });
  }

  const link = await resolvePublicLinkMetadata(host, payload.slug);

  if (!link) {
    return corsJson({ ok: true });
  }

  const userAgent = parseUserAgent(req.headers.get("user-agent") ?? "");
  const trafficQuality = evaluateTrafficQuality({
    accept: req.headers.get("accept"),
    country: req.headers.get("cf-ipcountry"),
    ipAddress: getRequestIp(req.headers),
    referrer: req.headers.get("referer"),
    userAgent: req.headers.get("user-agent"),
  });

  await enqueueAnalyticsEvent({
    kind: "page_activity",
    linkId: link.linkId,
    host,
    slug: payload.slug,
    eventType: payload.eventType,
    path: payload.path || "/",
    ipAddress: getRequestIp(req.headers),
    country: req.headers.get("cf-ipcountry") || "Unknown",
    city: req.headers.get("x-vercel-ip-city") || "Unknown",
    referrer: req.headers.get("referer") || "Direct",
    metadata: payload.metadata,
    userAgent: req.headers.get("user-agent"),
    ...trafficQuality,
    ...userAgent,
  });

  return corsJson({ ok: true });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

function corsJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  for (const [key, value] of Object.entries(corsHeaders())) {
    response.headers.set(key, value);
  }
  return response;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}
