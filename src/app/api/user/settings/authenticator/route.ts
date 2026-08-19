import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { noStoreJson } from "@/lib/no-store";
import { prisma } from "@/lib/prisma";
import { generateTotpSecret, totpUri, verifyTotp } from "@/lib/totp";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse("Unauthenticated", { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      authenticatorEnabled: true,
      authenticatorSecret: true,
    },
  });

  if (!user) {
    return new NextResponse("Unauthenticated", { status: 401 });
  }

  return noStoreJson({
    enabled: user.authenticatorEnabled,
    secret: user.authenticatorEnabled ? null : user.authenticatorSecret,
    otpauthUrl:
      !user.authenticatorEnabled && user.authenticatorSecret
        ? totpUri({ account: user.email, secret: user.authenticatorSecret })
        : null,
  });
}

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse("Unauthenticated", { status: 401 });
  }

  const secret = generateTotpSecret();
  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      authenticatorSecret: secret,
      authenticatorEnabled: false,
    },
    select: {
      email: true,
      authenticatorSecret: true,
    },
  });

  return noStoreJson({
    enabled: false,
    secret: user.authenticatorSecret,
    otpauthUrl: totpUri({ account: user.email, secret }),
  });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse("Unauthenticated", { status: 401 });
  }

  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      authenticatorSecret: true,
    },
  });

  if (!user?.authenticatorSecret || !verifyTotp(code, user.authenticatorSecret)) {
    return noStoreJson({ error: "Authenticator code is invalid." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { authenticatorEnabled: true },
  });

  return noStoreJson({ enabled: true });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse("Unauthenticated", { status: 401 });
  }

  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      authenticatorEnabled: true,
      authenticatorSecret: true,
    },
  });

  if (user?.authenticatorEnabled && !verifyTotp(code, user.authenticatorSecret)) {
    return noStoreJson({ error: "Authenticator code is invalid." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      authenticatorEnabled: false,
      authenticatorSecret: null,
    },
  });

  return noStoreJson({ enabled: false });
}
