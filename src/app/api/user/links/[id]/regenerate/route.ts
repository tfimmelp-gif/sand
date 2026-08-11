import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { generateSlug, isValidSlug } from "@/lib/links";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
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
  const payload = (await req.json().catch(() => ({}))) as { mode?: "short" | "long"; slug?: string };
  const requestedSlug = payload.slug?.trim();
  const requestedMode = payload.mode === "long" ? "long" : "short";

  if (requestedSlug && !isValidSlug(requestedSlug)) {
    return NextResponse.json({ error: "Slug can only contain letters, numbers, dashes, and underscores." }, { status: 400 });
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
    return NextResponse.json({ error: "Link not found." }, { status: 404 });
  }

  let nextSlug = requestedSlug ?? generateSlug(requestedMode === "long" ? 32 : 8);
  let updatedLink: {
    id: string;
    slug: string;
    destinationUrl: string;
    status: string;
    createdAt: Date;
    userId: string;
    domainId: string;
    domain: {
      hostString: string;
      status: string;
    };
    _count: {
      clicks: number;
    };
  } | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      updatedLink = await prisma.link.update({
        where: { id: existingLink.id },
        data: { slug: nextSlug },
        include: {
          domain: {
            select: {
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
      break;
    } catch {
      if (requestedSlug) {
        return NextResponse.json({ error: "That slug is already taken for this domain." }, { status: 409 });
      }

      nextSlug = generateSlug(requestedMode === "long" ? 32 : 8);
    }
  }

  if (!updatedLink) {
    return NextResponse.json({ error: "Could not generate an available slug." }, { status: 500 });
  }

  try {
    await Promise.all([
      redis.del(`link:${existingLink.domain.hostString}:${existingLink.slug}`),
      redis.set(`link:${existingLink.domain.hostString}:${updatedLink.slug}`, updatedLink.destinationUrl, {
        ex: 60 * 60 * 24,
      }),
    ]);
  } catch {
    // Cache refresh is best-effort.
  }

  return NextResponse.json(updatedLink);
}
