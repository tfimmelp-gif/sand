import { NextResponse } from "next/server";

import { flushAnalyticsQueue } from "@/lib/analytics-queue";
import { nextRotationDate, rotateLinkPrefix } from "@/lib/link-rotation";
import { prisma } from "@/lib/prisma";
import { linkAccessWhere } from "@/lib/tenant-access";

function isAuthorized(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return Boolean(process.env.INTERNAL_API_SECRET && token === process.env.INTERNAL_API_SECRET);
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const now = new Date();
  const [analytics, rotation, cleanup] = await Promise.all([flushAnalyticsQueue(250), rotateDueTenantLinks(now), cleanupExpiredAliases(now)]);

  return NextResponse.json({
    ok: true,
    analytics,
    rotation,
    cleanup,
  });
}

export async function GET(req: Request) {
  return POST(req);
}

async function rotateDueTenantLinks(now: Date) {
  const tenants = await prisma.user.findMany({
    where: {
      role: "WORKSPACE_USER",
      tenantAccessActive: true,
      autoRotationEnabled: true,
      autoRotationIntervalHours: { not: null },
      nextAutoRotationAt: { lte: now },
      OR: [{ tenantAccessExpiresAt: null }, { tenantAccessExpiresAt: { gt: now } }],
    },
    select: {
      id: true,
      autoRotationMode: true,
      autoRotationIntervalHours: true,
      links: {
        where: linkAccessWhere(now),
        select: { id: true },
      },
    },
    take: 25,
  });

  let tenantsProcessed = 0;
  let linksRotated = 0;
  let failures = 0;

  for (const tenant of tenants) {
    const intervalHours = tenant.autoRotationIntervalHours ?? 24;

    for (const link of tenant.links) {
      try {
        await rotateLinkPrefix({
          linkId: link.id,
          mode: tenant.autoRotationMode,
        });
        linksRotated += 1;
      } catch {
        failures += 1;
      }
    }

    await prisma.user.update({
      where: { id: tenant.id },
      data: {
        lastAutoRotationAt: now,
        nextAutoRotationAt: nextRotationDate(intervalHours, now),
      },
    });
    tenantsProcessed += 1;
  }

  return {
    tenantsProcessed,
    linksRotated,
    failures,
  };
}

async function cleanupExpiredAliases(now: Date) {
  const deletedAliases = await prisma.linkSlugAlias.deleteMany({
    where: {
      expiresAt: { lte: now },
    },
  });

  return {
    expiredAliasesDeleted: deletedAliases.count,
  };
}
