import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { ensureDefaultPagePresets, isPagePresetKey } from "@/lib/page-presets";
import { extractPresetZip } from "@/lib/preset-package";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "SUPER_ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  await ensureDefaultPagePresets();

  const presets = await prisma.linkPagePreset.findMany({
    orderBy: { key: "asc" },
    include: {
      files: {
        orderBy: { filePath: "asc" },
      },
    },
  });

  return NextResponse.json(presets);
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "SUPER_ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { key, name, description, htmlContent, files } = (await req.json()) as {
    key?: string;
    name?: string;
    description?: string;
    htmlContent?: string;
    files?: Array<{
      filePath: string;
      contentType: string;
      content: string;
      contentEncoding?: string;
    }>;
  };

  if (!key || !isPagePresetKey(key) || !name || !description || !htmlContent) {
    return NextResponse.json({ error: "Preset key, name, description, and HTML content are required." }, { status: 400 });
  }

  const preset = await prisma.linkPagePreset.update({
    where: { key },
    data: {
      name,
      description,
      htmlContent,
      files: {
        upsert: (files ?? []).map((file) => ({
          where: {
            presetKey_filePath: {
              presetKey: key,
              filePath: file.filePath,
            },
          },
          update: {
            contentType: file.contentType,
            content: file.content,
            contentEncoding: file.contentEncoding ?? "utf8",
          },
          create: {
            filePath: file.filePath,
            contentType: file.contentType,
            content: file.content,
            contentEncoding: file.contentEncoding ?? "utf8",
          },
        })),
      },
    },
    include: {
      files: {
        orderBy: { filePath: "asc" },
      },
    },
  });

  return NextResponse.json(preset);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "SUPER_ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  await ensureDefaultPagePresets();

  const formData = await req.formData();
  const key = String(formData.get("key") ?? "");
  const name = String(formData.get("name") ?? "");
  const description = String(formData.get("description") ?? "");
  const archive = formData.get("archive");

  if (!key || !isPagePresetKey(key)) {
    return NextResponse.json({ error: "Choose one of the available presets." }, { status: 400 });
  }

  if (!(archive instanceof File)) {
    return NextResponse.json({ error: "Upload a .zip preset package." }, { status: 400 });
  }

  if (!archive.name.toLowerCase().endsWith(".zip")) {
    return NextResponse.json({ error: "Preset package must be a .zip file." }, { status: 400 });
  }

  try {
    const files = extractPresetZip(Buffer.from(await archive.arrayBuffer()));
    const indexFile = files.find((file) => file.filePath === "index.html");
    const folderFiles = files.filter((file) => file.filePath !== "index.html");

    if (!indexFile) {
      return NextResponse.json({ error: "Preset ZIP must include index.html." }, { status: 400 });
    }

    const preset = await prisma.$transaction(async (tx) => {
      await tx.linkPagePresetFile.deleteMany({ where: { presetKey: key } });

      return tx.linkPagePreset.update({
        where: { key },
        data: {
          name: name.trim() || undefined,
          description: description.trim() || undefined,
          htmlContent: indexFile.content,
          files: {
            create: folderFiles.map((file) => ({
              filePath: file.filePath,
              contentType: file.contentType,
              content: file.content,
              contentEncoding: file.contentEncoding,
            })),
          },
        },
        include: {
          files: {
            orderBy: { filePath: "asc" },
          },
        },
      });
    });

    return NextResponse.json(preset);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to process preset ZIP." },
      { status: 400 },
    );
  }
}
