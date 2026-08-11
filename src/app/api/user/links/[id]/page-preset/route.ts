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

  if (!session) {
    return new NextResponse("Unauthenticated", { status: 401 });
  }

  const { id } = await context.params;
  const { indexPagePreset } = (await req.json()) as { indexPagePreset?: string };

  if (!indexPagePreset || !isPagePresetKey(indexPagePreset)) {
    return NextResponse.json({ error: "Choose one of the available page presets." }, { status: 400 });
  }

  const link = await prisma.link.updateMany({
    where: {
      id,
      userId: session.user.id,
    },
    data: {
      indexPagePreset,
    },
  });

  if (link.count === 0) {
    return NextResponse.json({ error: "Link not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, indexPagePreset });
}
