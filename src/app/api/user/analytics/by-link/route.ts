import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { flushAnalyticsQueue } from "@/lib/analytics-queue";
import { noStoreJson } from "@/lib/no-store";
import { prisma } from "@/lib/prisma";
import { getTenantAccess, linkAccessWhere } from "@/lib/tenant-access";

type LinkMetric = {
  linkId: string;
  clicks: number;
  uniqueVisitors: number;
  pageViews: number;
  formSubmissions: number;
  botVisits: number;
  highRiskEvents: number;
  lastVisitAt: string | null;
};

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse("Unauthenticated", { status: 401 });
  }

  const access = await getTenantAccess(session.user.id);

  if (!access.allowed) {
    return NextResponse.json({ error: access.reason }, { status: 403 });
  }

  await flushAnalyticsQueue(500).catch(() => null);

  const links = await prisma.link.findMany({
    where: {
      userId: session.user.id,
      ...linkAccessWhere(),
    },
    select: {
      id: true,
      metricSummary: true,
    },
  });
  const linkIds = links.map((link) => link.id);

  const [clickGroups, pageGroups, botClickGroups, botPageGroups, highRiskClickGroups, highRiskPageGroups, recentVisits] =
    linkIds.length > 0
      ? await Promise.all([
          prisma.clickLog.groupBy({
            by: ["linkId"],
            where: { linkId: { in: linkIds } },
            _count: { _all: true },
          }),
          prisma.pageActivity.groupBy({
            by: ["linkId", "eventType"],
            where: { linkId: { in: linkIds } },
            _count: { _all: true },
          }),
          prisma.clickLog.groupBy({
            by: ["linkId"],
            where: { linkId: { in: linkIds }, isBot: true },
            _count: { _all: true },
          }),
          prisma.pageActivity.groupBy({
            by: ["linkId"],
            where: { linkId: { in: linkIds }, isBot: true },
            _count: { _all: true },
          }),
          prisma.clickLog.groupBy({
            by: ["linkId"],
            where: { linkId: { in: linkIds }, riskScore: { gte: 75 } },
            _count: { _all: true },
          }),
          prisma.pageActivity.groupBy({
            by: ["linkId"],
            where: { linkId: { in: linkIds }, riskScore: { gte: 75 } },
            _count: { _all: true },
          }),
          prisma.pageActivity.groupBy({
            by: ["linkId"],
            where: { linkId: { in: linkIds } },
            _max: { timestamp: true },
          }),
        ])
      : [[], [], [], [], [], [], []] as const;

  const countByLink = new Map(clickGroups.map((row) => [row.linkId, row._count._all]));
  const botClicksByLink = new Map(botClickGroups.map((row) => [row.linkId, row._count._all]));
  const botPagesByLink = new Map(botPageGroups.map((row) => [row.linkId, row._count._all]));
  const highRiskClicksByLink = new Map(highRiskClickGroups.map((row) => [row.linkId, row._count._all]));
  const highRiskPagesByLink = new Map(highRiskPageGroups.map((row) => [row.linkId, row._count._all]));
  const lastVisitByLink = new Map(recentVisits.map((row) => [row.linkId, row._max.timestamp]));
  const pageViewsByLink = new Map<string, number>();
  const formsByLink = new Map<string, number>();
  const uniqueIpsByLink = new Map<string, Set<string>>();

  for (const row of pageGroups) {
    if (row.eventType === "page_view") {
      pageViewsByLink.set(row.linkId, row._count._all);
    }
    if (row.eventType === "form_submit") {
      formsByLink.set(row.linkId, row._count._all);
    }
  }

  if (linkIds.length > 0) {
    const [clickIps, pageIps] = await Promise.all([
      prisma.clickLog.findMany({
        where: { linkId: { in: linkIds } },
        select: { linkId: true, ipAddress: true },
      }),
      prisma.pageActivity.findMany({
        where: { linkId: { in: linkIds } },
        select: { linkId: true, ipAddress: true },
      }),
    ]);

    for (const row of [...clickIps, ...pageIps]) {
      if (!uniqueIpsByLink.has(row.linkId)) {
        uniqueIpsByLink.set(row.linkId, new Set());
      }
      uniqueIpsByLink.get(row.linkId)?.add(row.ipAddress || "Unknown");
    }
  }

  const metrics: LinkMetric[] = links.map((link) => {
    const rawClicks = countByLink.get(link.id) ?? 0;
    const rawPageViews = pageViewsByLink.get(link.id) ?? 0;
    const rawForms = formsByLink.get(link.id) ?? 0;
    const rawBotVisits = (botClicksByLink.get(link.id) ?? 0) + (botPagesByLink.get(link.id) ?? 0);
    const rawHighRiskEvents = (highRiskClicksByLink.get(link.id) ?? 0) + (highRiskPagesByLink.get(link.id) ?? 0);
    const lastVisitAt = link.metricSummary?.lastVisitAt ?? lastVisitByLink.get(link.id) ?? null;

    return {
      linkId: link.id,
      clicks: Math.max(link.metricSummary?.clicks ?? 0, rawClicks),
      uniqueVisitors: Math.max(link.metricSummary?.uniqueIps ?? 0, uniqueIpsByLink.get(link.id)?.size ?? 0),
      pageViews: Math.max(link.metricSummary?.pageViews ?? 0, rawPageViews),
      formSubmissions: Math.max(link.metricSummary?.formSubmissions ?? 0, rawForms),
      botVisits: Math.max(link.metricSummary?.botVisits ?? 0, rawBotVisits),
      highRiskEvents: Math.max(link.metricSummary?.highRiskEvents ?? 0, rawHighRiskEvents),
      lastVisitAt: lastVisitAt ? lastVisitAt.toISOString() : null,
    };
  });

  return noStoreJson(metrics);
}
