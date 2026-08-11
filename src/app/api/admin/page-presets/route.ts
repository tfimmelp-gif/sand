import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { ensureDefaultPagePresets, isPagePresetKey } from "@/lib/page-presets";
import { prisma } from "@/lib/prisma";

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
          },
          create: {
            filePath: file.filePath,
            contentType: file.contentType,
            content: file.content,
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
