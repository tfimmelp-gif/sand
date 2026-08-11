import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTenantAccess, linkAccessWhere } from "@/lib/tenant-access";

function topCounts<T extends string>(values: T[]) {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value || "Unknown", (counts.get(value || "Unknown") ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }));
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse("Unauthenticated", { status: 401 });
  }

  const access = await getTenantAccess(session.user.id);

  if (!access.allowed) {
    return NextResponse.json({ error: access.reason }, { status: 403 });
  }

  const [links, clicks, activities] = await Promise.all([
    prisma.link.findMany({
      where: {
        userId: session.user.id,
        ...linkAccessWhere(),
      },
      select: {
        id: true,
        status: true,
        domain: {
          select: {
            status: true,
          },
        },
      },
    }),
    prisma.clickLog.findMany({
      where: {
        link: {
          userId: session.user.id,
          ...linkAccessWhere(),
        },
      },
      select: {
        country: true,
        referrer: true,
        device: true,
        browser: true,
        ipAddress: true,
        isBot: true,
        riskScore: true,
      },
    }),
    prisma.pageActivity.findMany({
      where: {
        link: {
          userId: session.user.id,
          ...linkAccessWhere(),
        },
      },
      select: {
        eventType: true,
        ipAddress: true,
        isBot: true,
        riskScore: true,
      },
    }),
  ]);

  const healthyDomains = links.filter((link) => link.domain.status === "ACTIVE").length;

  return NextResponse.json({
    totalClicks: clicks.length,
    uniqueVisitors: new Set([...clicks.map((click) => click.ipAddress), ...activities.map((activity) => activity.ipAddress)]).size,
    activeLinks: links.filter((link) => link.status === "ACTIVE").length,
    pageViews: activities.filter((activity) => activity.eventType === "page_view").length,
    formSubmissions: activities.filter((activity) => activity.eventType === "form_submit").length,
    suspectedBots: clicks.filter((click) => click.isBot).length + activities.filter((activity) => activity.isBot).length,
    highRiskEvents:
      clicks.filter((click) => click.riskScore >= 75).length + activities.filter((activity) => activity.riskScore >= 75).length,
    domainHealth: links.length ? Math.round((healthyDomains / links.length) * 100) : 100,
    topCountries: topCounts(clicks.map((click) => click.country)),
    topReferrers: topCounts(clicks.map((click) => click.referrer)),
    topDevices: topCounts(clicks.map((click) => click.device)),
    topBrowsers: topCounts(clicks.map((click) => click.browser)),
  });
}
