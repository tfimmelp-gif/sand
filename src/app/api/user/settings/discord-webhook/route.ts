import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { maskedWebhookUrl, sendDiscordFormSubmission, validateDiscordWebhookUrl } from "@/lib/discord-webhook";
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
    return NextResponse.json({ error: access.reason }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { discordWebhookUrl: true },
  });

  return noStoreJson({
    enabled: Boolean(user?.discordWebhookUrl),
    maskedUrl: maskedWebhookUrl(user?.discordWebhookUrl),
  });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse("Unauthenticated", { status: 401 });
  }

  const access = await getTenantAccess(session.user.id);

  if (!access.allowed) {
    return NextResponse.json({ error: access.reason }, { status: 403 });
  }

  const { webhookUrl } = (await req.json().catch(() => ({}))) as { webhookUrl?: string | null };
  const trimmedUrl = webhookUrl?.trim() ?? "";

  if (trimmedUrl && !validateDiscordWebhookUrl(trimmedUrl)) {
    return NextResponse.json({ error: "Enter a valid Discord webhook URL." }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      discordWebhookUrl: trimmedUrl || null,
    },
    select: { discordWebhookUrl: true },
  });

  return noStoreJson({
    enabled: Boolean(user.discordWebhookUrl),
    maskedUrl: maskedWebhookUrl(user.discordWebhookUrl),
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse("Unauthenticated", { status: 401 });
  }

  const access = await getTenantAccess(session.user.id);

  if (!access.allowed) {
    return NextResponse.json({ error: access.reason }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      discordWebhookUrl: true,
      assignedDomain: { select: { hostString: true } },
    },
  });

  if (!user?.discordWebhookUrl) {
    return NextResponse.json({ error: "No Discord webhook is saved." }, { status: 400 });
  }

  const delivery = await sendDiscordFormSubmission({
    webhookUrl: user.discordWebhookUrl,
    host: user.assignedDomain?.hostString ?? "tenant-domain",
    slug: "test-message",
    path: "/dashboard.html",
    ipAddress: "Test",
    country: "Test",
    city: "Test",
    browser: "Test",
    os: "Test",
    device: "Test",
    referrer: "Tenant dashboard",
    isBot: false,
    riskScore: 0,
    metadata: {
      fields: {
        message: "Discord webhook test from Link Platform",
      },
    },
  });

  if (!delivery.ok) {
    return NextResponse.json(
      { error: delivery.error ?? "Discord webhook test failed.", status: delivery.status },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
