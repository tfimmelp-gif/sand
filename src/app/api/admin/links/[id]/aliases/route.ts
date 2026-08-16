import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { clearLinkAndAliasCaches } from "@/lib/link-rotation";
import { noStoreJson } from "@/lib/no-store";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_req: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "SUPER_ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id } = await context.params;
  const link = await prisma.link.findUnique({
    where: { id },
    select: {
      slug: true,
      domain: { select: { hostString: true } },
      slugAliases: { select: { id: true, slug: true } },
    },
  });

  if (!link) {
    return noStoreJson({ error: "Link not found." }, { status: 404 });
  }

  await prisma.linkSlugAlias.deleteMany({
    where: { linkId: id },
  });

  await clearLinkAndAliasCaches({
    host: link.domain.hostString,
    slug: link.slug,
    aliases: link.slugAliases,
  }).catch(() => undefined);

  return noStoreJson({ ok: true, cleared: link.slugAliases.length });
}
