import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { activeSlugAliasExists, LINK_ALIAS_TTL_SECONDS, linkAliasExpiresAt } from "@/lib/link-aliases";
import { generateSlug, isValidSlug } from "@/lib/links";
import { noStoreJson } from "@/lib/no-store";
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

  let nextSlug = requestedSlug ?? generateSlug(requestedMode === "long" ? 32 : 8);
  let updatedLink: Awaited<ReturnType<typeof updateLinkSlugWithAlias>> | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const aliasCollision = await activeSlugAliasExists(existingLink.domainId, nextSlug);

    if (aliasCollision) {
      if (requestedSlug) {
        return noStoreJson({ error: "That slug is already reserved by a recently rotated URL." }, { status: 409 });
      }

      nextSlug = generateSlug(requestedMode === "long" ? 32 : 8);
      continue;
    }

    try {
      updatedLink = await updateLinkSlugWithAlias(existingLink.id, existingLink.domainId, existingLink.slug, nextSlug);
      break;
    } catch {
      if (requestedSlug) {
        return noStoreJson({ error: "That slug is already taken for this domain." }, { status: 409 });
      }

      nextSlug = generateSlug(requestedMode === "long" ? 32 : 8);
    }
  }

  if (!updatedLink) {
    return noStoreJson({ error: "Could not generate an available slug." }, { status: 500 });
  }

  try {
    await Promise.all([
      redis.set(`link:${existingLink.domain.hostString}:${existingLink.slug}`, existingLink.destinationUrl, {
        ex: LINK_ALIAS_TTL_SECONDS,
      }),
      redis.set(`link:${existingLink.domain.hostString}:${updatedLink.slug}`, updatedLink.destinationUrl, {
        ex: 60 * 60 * 24,
      }),
    ]);
  } catch {
    // Cache refresh is best-effort.
  }

  return noStoreJson(updatedLink);
}

function updateLinkSlugWithAlias(linkId: string, domainId: string, previousSlug: string, nextSlug: string) {
  return prisma.$transaction(async (tx) => {
    await tx.linkSlugAlias.upsert({
      where: {
        domainId_slug: {
          domainId,
          slug: previousSlug,
        },
      },
      update: {
        linkId,
        expiresAt: linkAliasExpiresAt(),
      },
      create: {
        linkId,
        domainId,
        slug: previousSlug,
        expiresAt: linkAliasExpiresAt(),
      },
    });

    return tx.link.update({
      where: { id: linkId },
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
        slugAliases: {
          where: {
            expiresAt: {
              gt: new Date(),
            },
          },
          orderBy: {
            expiresAt: "desc",
          },
          select: {
            id: true,
            slug: true,
            expiresAt: true,
          },
        },
      },
    });
  });
}
