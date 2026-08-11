import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { isPagePresetKey } from "@/lib/page-presets";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "SUPER_ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id } = await context.params;
  const { indexPagePreset } = (await req.json()) as { indexPagePreset?: string };

  if (!indexPagePreset || !isPagePresetKey(indexPagePreset)) {
    return NextResponse.json({ error: "Choose one of the available page presets." }, { status: 400 });
  }

  try {
    const link = await prisma.link.update({
      where: { id },
      data: { indexPagePreset },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        domain: {
          select: {
            id: true,
            hostString: true,
            status: true,
          },
        },
        _count: {
          select: {
            clicks: true,
          },
        },
      },
    });

    return NextResponse.json(link);
  } catch {
    return NextResponse.json({ error: "Link not found." }, { status: 404 });
  }
}
