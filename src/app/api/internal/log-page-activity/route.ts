import { NextResponse } from "next/server";

import { sendDiscordFormSubmission } from "@/lib/discord-webhook";
import { prisma } from "@/lib/prisma";
import { getRequestIp, parseUserAgent } from "@/lib/request-insights";
import { publicLinkAccessWhere } from "@/lib/tenant-access";
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

  let link = await prisma.link.findFirst({
    where: {
      slug: payload.slug,
      ...publicLinkAccessWhere(payload.host),
    },
    select: {
      id: true,
      slug: true,
      domain: { select: { hostString: true } },
      user: { select: { discordWebhookUrl: true } },
    },
  });

  if (!link) {
    const alias = await prisma.linkSlugAlias.findFirst({
      where: {
        slug: payload.slug,
        expiresAt: {
          gt: new Date(),
        },
        domain: {
          hostString: payload.host,
          status: "ACTIVE",
        },
        link: publicLinkAccessWhere(payload.host),
      },
      select: {
        link: {
          select: {
            id: true,
            slug: true,
            domain: { select: { hostString: true } },
            user: { select: { discordWebhookUrl: true } },
          },
        },
      },
    });

    link = alias?.link ?? null;
  }

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

  const activity = await prisma.pageActivity.create({
    data: {
      linkId: link.id,
      eventType: payload.eventType,
      path: payload.path || "/",
      ipAddress: payload.ipAddress || getRequestIp(req.headers),
      country: payload.country || "Unknown",
      city: payload.city || "Unknown",
      referrer: payload.referrer || "Direct",
      metadata: typeof payload.metadata === "object" && payload.metadata !== null ? payload.metadata : undefined,
      ...trafficQuality,
      ...userAgent,
    },
  });

  if (activity.eventType === "form_submit") {
    await sendDiscordFormSubmission({
      webhookUrl: link.user.discordWebhookUrl,
      host: link.domain.hostString,
      slug: link.slug,
      path: activity.path,
      ipAddress: activity.ipAddress,
      country: activity.country,
      city: activity.city,
      browser: activity.browser,
      os: activity.os,
      device: activity.device,
      referrer: activity.referrer,
      isBot: activity.isBot,
      botReason: activity.botReason,
      riskScore: activity.riskScore,
      metadata: activity.metadata,
    });
  }

  return NextResponse.json({ ok: true });
}
