import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
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

  const metrics: LinkMetric[] = links.map((link) => {
    return {
      linkId: link.id,
      clicks: link.metricSummary?.clicks ?? 0,
      uniqueVisitors: link.metricSummary?.uniqueIps ?? 0,
      pageViews: link.metricSummary?.pageViews ?? 0,
      formSubmissions: link.metricSummary?.formSubmissions ?? 0,
      botVisits: link.metricSummary?.botVisits ?? 0,
      highRiskEvents: link.metricSummary?.highRiskEvents ?? 0,
      lastVisitAt: link.metricSummary?.lastVisitAt ? link.metricSummary.lastVisitAt.toISOString() : null,
    };
  });

  return noStoreJson(metrics);
}
