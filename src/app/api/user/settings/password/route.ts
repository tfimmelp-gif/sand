import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";

import { authOptions } from "@/lib/auth";
import { noStoreJson } from "@/lib/no-store";
import { prisma } from "@/lib/prisma";
import { getTenantAccess } from "@/lib/tenant-access";

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse("Unauthenticated", { status: 401 });
  }

  if (session.user.role !== "WORKSPACE_USER") {
    return noStoreJson({ error: "Only tenant users can change workspace passwords here." }, { status: 403 });
  }

  const access = await getTenantAccess(session.user.id);

  if (!access.allowed) {
    return noStoreJson({ error: access.reason }, { status: 403 });
  }

  const { currentPassword, newPassword } = (await req.json().catch(() => ({}))) as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return noStoreJson({ error: "Current password and a new 8+ character password are required." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });

  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return noStoreJson({ error: "Current password is incorrect." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 12) },
  });

  return noStoreJson({ ok: true });
}
