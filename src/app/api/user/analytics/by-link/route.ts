import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
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

function newestDate(current: Date | null, next: Date) {
  if (!current || next.getTime() > current.getTime()) {
    return next;
  }

  return current;
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

  const links = await prisma.link.findMany({
    where: {
      userId: session.user.id,
      ...linkAccessWhere(),
    },
    select: {
      id: true,
      clicks: {
        select: {
          ipAddress: true,
          isBot: true,
          riskScore: true,
          timestamp: true,
        },
      },
      activities: {
        select: {
          eventType: true,
          ipAddress: true,
          isBot: true,
          riskScore: true,
          timestamp: true,
        },
      },
    },
  });

  const metrics: LinkMetric[] = links.map((link) => {
    const visitors = new Set<string>();
    let lastVisitAt: Date | null = null;

    for (const click of link.clicks) {
      visitors.add(click.ipAddress);
      lastVisitAt = newestDate(lastVisitAt, click.timestamp);
    }

    for (const activity of link.activities) {
      visitors.add(activity.ipAddress);
      lastVisitAt = newestDate(lastVisitAt, activity.timestamp);
    }

    return {
      linkId: link.id,
      clicks: link.clicks.length,
      uniqueVisitors: visitors.size,
      pageViews: link.activities.filter((activity) => activity.eventType === "page_view").length,
      formSubmissions: link.activities.filter((activity) => activity.eventType === "form_submit").length,
      botVisits: link.clicks.filter((click) => click.isBot).length + link.activities.filter((activity) => activity.isBot).length,
      highRiskEvents:
        link.clicks.filter((click) => click.riskScore >= 75).length +
        link.activities.filter((activity) => activity.riskScore >= 75).length,
      lastVisitAt: lastVisitAt ? lastVisitAt.toISOString() : null,
    };
  });

  return NextResponse.json(metrics);
}
