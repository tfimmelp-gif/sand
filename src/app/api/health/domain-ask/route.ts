import { NextResponse } from "next/server";

export async function GET() {
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN;

  if (!appDomain) {
    return NextResponse.json({ ok: false, error: "NEXT_PUBLIC_APP_DOMAIN is missing." }, { status: 503 });
  }

  const origin = process.env.INTERNAL_APP_ORIGIN || process.env.NEXTAUTH_URL || `http://${appDomain}`;
  const response = await fetch(`${origin}/api/domains/check-allowed?domain=${encodeURIComponent(appDomain)}`, {
    cache: "no-store",
  }).catch(() => null);

  return NextResponse.json(
    {
      ok: Boolean(response),
      status: response?.status ?? 0,
    },
    {
      status: response ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
