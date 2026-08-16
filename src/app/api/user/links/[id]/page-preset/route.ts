import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { primeLinkMetadataCache } from "@/lib/link-cache";
import { isPagePresetKey } from "@/lib/page-presets";
import { prisma } from "@/lib/prisma";
import { getTenantAccess, linkAccessWhere } from "@/lib/tenant-access";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse("Unauthenticated", { status: 401 });
  }

  const access = await getTenantAccess(session.user.id);

  if (!access.allowed) {
    return NextResponse.json({ error: access.reason }, { status: 403 });
  }

  const { id } = await context.params;
  const { indexPagePreset } = (await req.json()) as { indexPagePreset?: string };

  if (!indexPagePreset || !isPagePresetKey(indexPagePreset)) {
    return NextResponse.json({ error: "Choose one of the available page presets." }, { status: 400 });
  }

  const existingLink = await prisma.link.findFirst({
    where: {
      id,
      userId: session.user.id,
      ...linkAccessWhere(),
    },
    select: { id: true },
  });

  if (!existingLink) {
    return NextResponse.json({ error: "Link not found." }, { status: 404 });
  }

  const link = await prisma.link.update({
    where: { id: existingLink.id },
    data: {
      indexPagePreset,
    },
    include: {
      domain: { select: { hostString: true } },
    },
  });

  await primeLinkMetadataCache({
    linkId: link.id,
    host: link.domain.hostString,
    slug: link.slug,
    canonicalSlug: link.slug,
    destinationUrl: link.destinationUrl,
    indexPagePreset: link.indexPagePreset,
    redirectSource: link.redirectSource,
    expiresAt: link.expiresAt?.toISOString() ?? null,
    status: link.status,
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, indexPagePreset });
}
