import { NextResponse } from "next/server";

import { DEFAULT_PAGE_PRESETS, ensureDefaultPagePresets, renderIndexHtml } from "@/lib/page-presets";
import { prisma } from "@/lib/prisma";
import { publicLinkAccessWhere } from "@/lib/tenant-access";

function normalizeSlug(slug: string) {
  return slug
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\/index\.html$/i, "");
}

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!process.env.INTERNAL_API_SECRET || token !== process.env.INTERNAL_API_SECRET) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { host, slug, filePath } = (await req.json()) as {
    host?: string;
    slug?: string;
    filePath?: string;
  };
  const normalizedSlug = slug ? normalizeSlug(slug) : "";
  const normalizedFilePath = (filePath || "index.html").replace(/^\/+/, "").replace(/\\/g, "/");

  if (!host || !normalizedSlug || normalizedFilePath.includes("..")) {
    return NextResponse.json({ error: "Missing host or slug." }, { status: 400 });
  }

  await ensureDefaultPagePresets();

  const link = await prisma.link.findFirst({
    where: {
      slug: normalizedSlug,
      ...publicLinkAccessWhere(host),
    },
    select: {
      destinationUrl: true,
      indexPagePreset: true,
      redirectSource: true,
      slug: true,
      domain: {
        select: {
          hostString: true,
        },
      },
    },
  });

  if (!link) {
    return NextResponse.json({ found: false }, { status: 404 });
  }

  if (normalizedFilePath !== "index.html") {
    const file = await prisma.linkPagePresetFile.findUnique({
      where: {
        presetKey_filePath: {
          presetKey: link.indexPagePreset,
          filePath: normalizedFilePath,
        },
      },
      select: {
        content: true,
        contentType: true,
      },
    });

    if (!file) {
      return NextResponse.json({ found: false }, { status: 404 });
    }

    return new NextResponse(
      renderIndexHtml(file.content, {
        destinationUrl: link.destinationUrl,
        adminDestinationUrl: link.destinationUrl,
        host: link.domain.hostString,
        redirectSource: link.redirectSource,
        shortUrl: `${link.domain.hostString}/${link.slug}`,
        slug: link.slug,
      }),
      {
        headers: {
          "Content-Type": file.contentType,
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const preset = await prisma.linkPagePreset.findUnique({
    where: { key: link.indexPagePreset },
    select: {
      htmlContent: true,
    },
  });
  const fallback = DEFAULT_PAGE_PRESETS[0].htmlContent;
  const html = renderIndexHtml(preset?.htmlContent ?? fallback, {
    destinationUrl: link.destinationUrl,
    adminDestinationUrl: link.destinationUrl,
    host: link.domain.hostString,
    redirectSource: link.redirectSource,
    shortUrl: `${link.domain.hostString}/${link.slug}`,
    slug: link.slug,
  });

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
