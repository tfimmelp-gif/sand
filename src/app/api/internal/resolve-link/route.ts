import { NextResponse } from "next/server";

import { resolvePublicLinkMetadata, normalizePublicSlug } from "@/lib/public-link";

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!process.env.INTERNAL_API_SECRET || token !== process.env.INTERNAL_API_SECRET) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { host, slug } = (await req.json()) as {
    host?: string;
    slug?: string;
  };

  const normalizedSlug = slug ? normalizePublicSlug(slug) : "";

  if (!host || !normalizedSlug) {
    return NextResponse.json({ error: "Missing host or slug." }, { status: 400 });
  }

  const link = await resolvePublicLinkMetadata(host, normalizedSlug);

  if (!link || link.redirectSource === "PRESET_CONTROLLED") {
    return NextResponse.json({ found: false }, { status: 404 });
  }

  return NextResponse.json({
    found: true,
    destinationUrl: link.destinationUrl,
  });
}
