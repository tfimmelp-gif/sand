import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { isValidSlug } from "@/lib/links";
import { rotateLinkPrefix } from "@/lib/link-rotation";
import { noStoreJson } from "@/lib/no-store";
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
    return noStoreJson({ error: access.reason }, { status: 403 });
  }

  const { id } = await context.params;
  const payload = (await req.json().catch(() => ({}))) as { mode?: "short" | "long"; slug?: string };
  const requestedSlug = payload.slug?.trim();
  const requestedMode = payload.mode === "long" ? "long" : "short";

  if (requestedSlug && !isValidSlug(requestedSlug)) {
    return noStoreJson({ error: "Slug can only contain letters, numbers, dashes, and underscores." }, { status: 400 });
  }

  const existingLink = await prisma.link.findFirst({
    where: {
      id,
      userId: session.user.id,
      ...linkAccessWhere(),
    },
    include: {
      domain: {
        select: {
          hostString: true,
        },
      },
    },
  });

  if (!existingLink) {
    return noStoreJson({ error: "Link not found." }, { status: 404 });
  }

  try {
    const updatedLink = await rotateLinkPrefix({
      linkId: existingLink.id,
      mode: requestedMode === "long" ? "LONG" : "SHORT",
      requestedSlug,
    });

    if (!updatedLink) {
      return noStoreJson({ error: "Link not found." }, { status: 404 });
    }

    return noStoreJson(updatedLink);
  } catch {
    return noStoreJson({ error: requestedSlug ? "That slug is already taken or reserved." : "Could not generate an available slug." }, { status: 409 });
  }
}
