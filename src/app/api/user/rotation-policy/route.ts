import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { noStoreJson } from "@/lib/no-store";
import { prisma } from "@/lib/prisma";
import { getTenantAccess } from "@/lib/tenant-access";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse("Unauthenticated", { status: 401 });
  }

  const access = await getTenantAccess(session.user.id);

  if (!access.allowed) {
    return noStoreJson({ error: access.reason }, { status: 403 });
  }

  const tenant = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      autoRotationEnabled: true,
      autoRotationMode: true,
      autoRotationIntervalHours: true,
      nextAutoRotationAt: true,
      lastAutoRotationAt: true,
    },
  });

  return noStoreJson(
    tenant ?? {
      autoRotationEnabled: false,
      autoRotationMode: "SHORT",
      autoRotationIntervalHours: null,
      nextAutoRotationAt: null,
      lastAutoRotationAt: null,
    },
  );
}
