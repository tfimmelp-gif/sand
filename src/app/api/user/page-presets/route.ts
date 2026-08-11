import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { ensureDefaultPagePresets } from "@/lib/page-presets";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse("Unauthenticated", { status: 401 });
  }

  await ensureDefaultPagePresets();

  const presets = await prisma.linkPagePreset.findMany({
    orderBy: { key: "asc" },
    select: {
      key: true,
      name: true,
      description: true,
    },
  });

  return NextResponse.json(presets);
}
