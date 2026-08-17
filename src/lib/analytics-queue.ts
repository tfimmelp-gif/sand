import { sendDiscordFormSubmission } from "@/lib/discord-webhook";
import { getCachedLinkMetadata } from "@/lib/link-cache";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

const QUEUE_KEY = "analytics-events:v1";

type BaseAnalyticsEvent = {
  linkId: string;
  host: string;
  slug: string;
  userAgent?: string | null;
  country?: string;
  city?: string;
  referrer?: string;
  ipAddress?: string;
  browser: string;
  os: string;
  device: string;
  isBot: boolean;
  botReason?: string | null;
  riskScore: number;
};

export type ClickAnalyticsEvent = BaseAnalyticsEvent & {
  kind: "click";
};

export type PageActivityAnalyticsEvent = BaseAnalyticsEvent & {
  kind: "page_activity";
  eventType: string;
  path: string;
  metadata?: unknown;
};

export type AnalyticsEvent = ClickAnalyticsEvent | PageActivityAnalyticsEvent;

export async function enqueueAnalyticsEvent(event: AnalyticsEvent) {
  try {
    await redis.rpush(QUEUE_KEY, JSON.stringify(event));
    if (process.env.ANALYTICS_DEBUG === "true") {
      console.info("analytics queued", { kind: event.kind, linkId: event.linkId, slug: event.slug });
    }
  } catch (error) {
    console.warn("analytics redis queue failed; persisting directly", {
      kind: event.kind,
      linkId: event.linkId,
      slug: event.slug,
      error,
    });
    await persistAnalyticsEvents([event]);
  }
}

export async function flushAnalyticsQueue(limit = 200) {
  const rawEvents: string[] = [];

  for (let index = 0; index < limit; index += 1) {
    const raw = await redis.lpop<string>(QUEUE_KEY);
    if (!raw) {
      break;
    }
    rawEvents.push(raw);
  }

  const events = rawEvents
    .map((raw) => {
      try {
        return JSON.parse(raw) as AnalyticsEvent;
      } catch {
        return null;
      }
    })
    .filter((event): event is AnalyticsEvent => Boolean(event));

  const clicks = events.filter((event): event is ClickAnalyticsEvent => event.kind === "click");
  const pageActivities = events.filter((event): event is PageActivityAnalyticsEvent => event.kind === "page_activity");

  const discordDeliveries = await persistAnalyticsEvents(events);

  return {
    processed: events.length,
    clicks: clicks.length,
    pageActivities: pageActivities.length,
    discordDeliveries,
  };
}

async function persistAnalyticsEvents(events: AnalyticsEvent[]) {
  const clicks = events.filter((event): event is ClickAnalyticsEvent => event.kind === "click");
  const pageActivities = events.filter((event): event is PageActivityAnalyticsEvent => event.kind === "page_activity");

  if (clicks.length > 0) {
    await prisma.clickLog.createMany({
      data: clicks.map((event) => ({
        linkId: event.linkId,
        country: event.country || "Unknown",
        city: event.city || "Unknown",
        referrer: event.referrer || "Direct",
        ipAddress: event.ipAddress || "Unknown",
        browser: event.browser,
        os: event.os,
        device: event.device,
        isBot: event.isBot,
        botReason: event.botReason,
        riskScore: event.riskScore,
      })),
    });
  }

  let discordDeliveries = { attempted: 0, sent: 0, failed: 0 };

  if (pageActivities.length > 0) {
    await prisma.pageActivity.createMany({
      data: pageActivities.map((event) => ({
        linkId: event.linkId,
        eventType: event.eventType,
        path: event.path || "/",
        ipAddress: event.ipAddress || "Unknown",
        country: event.country || "Unknown",
        city: event.city || "Unknown",
        referrer: event.referrer || "Direct",
        metadata: typeof event.metadata === "object" && event.metadata !== null ? event.metadata : undefined,
        browser: event.browser,
        os: event.os,
        device: event.device,
        isBot: event.isBot,
        botReason: event.botReason,
        riskScore: event.riskScore,
      })),
    });

    const formSubmissions = pageActivities.filter((event) => event.eventType === "form_submit");
    if (formSubmissions.length > 0) {
      discordDeliveries = await sendFormSubmissionsToDiscord(formSubmissions);
    }
  }

  await Promise.all(events.map((event) => updateSummaryForEvent(event)));

  if (events.length > 0 && process.env.ANALYTICS_DEBUG === "true") {
    console.info("analytics persisted", {
      events: events.length,
      clicks: clicks.length,
      pageActivities: pageActivities.length,
      discordDeliveries,
    });
  }

  return discordDeliveries;
}

async function updateSummaryForEvent(event: AnalyticsEvent) {
  const isPageView = event.kind === "page_activity" && event.eventType === "page_view";
  const isFormSubmission = event.kind === "page_activity" && event.eventType === "form_submit";
  const ipAddress = event.ipAddress || "Unknown";

  const currentUniqueIp = await prisma.pageActivity.findFirst({
    where: { linkId: event.linkId, ipAddress },
    select: { id: true },
  });
  const currentUniqueClickIp = currentUniqueIp
    ? null
    : await prisma.clickLog.findFirst({
        where: { linkId: event.linkId, ipAddress },
        select: { id: true },
      });

  await prisma.linkMetricSummary.upsert({
    where: { linkId: event.linkId },
    create: {
      linkId: event.linkId,
      clicks: event.kind === "click" ? 1 : 0,
      pageViews: isPageView ? 1 : 0,
      formSubmissions: isFormSubmission ? 1 : 0,
      botVisits: event.isBot ? 1 : 0,
      highRiskEvents: event.riskScore >= 75 ? 1 : 0,
      uniqueIps: currentUniqueIp || currentUniqueClickIp ? 0 : 1,
      lastVisitAt: new Date(),
    },
    update: {
      clicks: event.kind === "click" ? { increment: 1 } : undefined,
      pageViews: isPageView ? { increment: 1 } : undefined,
      formSubmissions: isFormSubmission ? { increment: 1 } : undefined,
      botVisits: event.isBot ? { increment: 1 } : undefined,
      highRiskEvents: event.riskScore >= 75 ? { increment: 1 } : undefined,
      uniqueIps: currentUniqueIp || currentUniqueClickIp ? undefined : { increment: 1 },
      lastVisitAt: new Date(),
    },
  });
}

async function sendFormSubmissionsToDiscord(events: PageActivityAnalyticsEvent[]) {
  const links = await prisma.link.findMany({
    where: { id: { in: [...new Set(events.map((event) => event.linkId))] } },
    select: {
      id: true,
      slug: true,
      domain: { select: { hostString: true } },
      user: { select: { discordWebhookUrl: true } },
    },
  });
  const linkById = new Map(links.map((link) => [link.id, link]));

  const results = await Promise.all(
    events.map(async (event) => {
      const link = linkById.get(event.linkId);
      if (!link?.user.discordWebhookUrl) {
        if (process.env.ANALYTICS_DEBUG === "true") {
          console.warn("discord webhook missing for form submission", { linkId: event.linkId });
        }
        return { attempted: false, ok: false };
      }

      const cached = await getCachedLinkMetadata(event.host, event.slug).catch(() => null);
      const delivery = await sendDiscordFormSubmission({
        webhookUrl: link.user.discordWebhookUrl,
        host: link.domain.hostString,
        slug: cached?.canonicalSlug ?? link.slug,
        path: event.path,
        ipAddress: event.ipAddress || "Unknown",
        country: event.country || "Unknown",
        city: event.city || "Unknown",
        browser: event.browser,
        os: event.os,
        device: event.device,
        referrer: event.referrer || "Direct",
        isBot: event.isBot,
        botReason: event.botReason,
        riskScore: event.riskScore,
        metadata: event.metadata,
      });

      if (!delivery.ok) {
        console.error("discord webhook delivery failed", {
          linkId: event.linkId,
          status: delivery.status,
          error: delivery.error,
        });
      } else if (process.env.ANALYTICS_DEBUG === "true") {
        console.info("discord webhook delivered", { linkId: event.linkId, status: delivery.status });
      }

      return { attempted: true, ok: delivery.ok };
    }),
  );

  return results.reduce(
    (total, result) => ({
      attempted: total.attempted + (result.attempted ? 1 : 0),
      sent: total.sent + (result.ok ? 1 : 0),
      failed: total.failed + (result.attempted && !result.ok ? 1 : 0),
    }),
    { attempted: 0, sent: 0, failed: 0 },
  );
}
