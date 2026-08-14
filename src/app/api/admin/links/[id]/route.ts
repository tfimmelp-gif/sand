import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { parseExpiryInput } from "@/lib/expiration";
import { activeSlugAliasExists, LINK_ALIAS_TTL_SECONDS, linkAliasExpiresAt } from "@/lib/link-aliases";
import { isValidSlug, validateDestinationUrl } from "@/lib/links";
import { noStoreJson } from "@/lib/no-store";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "SUPER_ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id } = await context.params;
  const payload = (await req.json().catch(() => ({}))) as {
    destinationUrl?: string;
    expiresAt?: string | null;
    expiryBundle?: string | null;
    redirectSource?: "ADMIN_DESTINATION" | "PRESET_CONTROLLED";
    slug?: string;
  };

  const existingLink = await prisma.link.findUnique({
    where: { id },
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

  const nextSlug = payload.slug?.trim() || existingLink.slug;
  if (!isValidSlug(nextSlug)) {
    return noStoreJson({ error: "Slug can only contain letters, numbers, dashes, and underscores." }, { status: 400 });
  }

  let nextDestinationUrl = existingLink.destinationUrl;
  if (payload.destinationUrl !== undefined) {
    try {
      nextDestinationUrl = validateDestinationUrl(payload.destinationUrl);
    } catch (error) {
      return noStoreJson({ error: error instanceof Error ? error.message : "Invalid destination URL." }, { status: 400 });
    }
  }

  const slugChanged = nextSlug !== existingLink.slug;
  if (slugChanged && (await activeSlugAliasExists(existingLink.domainId, nextSlug))) {
    return noStoreJson({ error: "That slug is reserved by a recently rotated URL." }, { status: 409 });
  }

  try {
    const link = await prisma.$transaction(async (tx) => {
      if (slugChanged) {
        await tx.linkSlugAlias.upsert({
          where: {
            domainId_slug: {
              domainId: existingLink.domainId,
              slug: existingLink.slug,
            },
          },
          update: {
            linkId: existingLink.id,
            expiresAt: linkAliasExpiresAt(),
          },
          create: {
            linkId: existingLink.id,
            domainId: existingLink.domainId,
            slug: existingLink.slug,
            expiresAt: linkAliasExpiresAt(),
          },
        });
      }

      return tx.link.update({
        where: { id },
        data: {
          slug: nextSlug,
          destinationUrl: nextDestinationUrl,
          redirectSource:
            payload.redirectSource === "PRESET_CONTROLLED" || payload.redirectSource === "ADMIN_DESTINATION"
              ? payload.redirectSource
              : undefined,
          expiresAt:
            payload.expiresAt !== undefined || payload.expiryBundle !== undefined
              ? parseExpiryInput({ expiresAt: payload.expiresAt, expiryBundle: payload.expiryBundle })
              : undefined,
        },
        include: {
          user: { select: { id: true, email: true } },
          domain: { select: { id: true, hostString: true, status: true } },
          _count: { select: { clicks: true } },
          slugAliases: {
            where: { expiresAt: { gt: new Date() } },
            orderBy: { expiresAt: "desc" },
            select: { id: true, slug: true, expiresAt: true },
          },
        },
      });
    });

    try {
      await Promise.all([
        slugChanged
          ? redis.set(`link:${existingLink.domain.hostString}:${existingLink.slug}`, existingLink.destinationUrl, {
              ex: LINK_ALIAS_TTL_SECONDS,
            })
          : Promise.resolve(),
        redis.set(`link:${existingLink.domain.hostString}:${link.slug}`, link.destinationUrl, { ex: 60 * 60 * 24 }),
      ]);
    } catch {
      // Cache is best-effort; DB remains the source of truth.
    }

    return noStoreJson(link);
  } catch {
    return noStoreJson({ error: "Unable to update link. The slug may already exist." }, { status: 409 });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "SUPER_ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id } = await context.params;
  const existingLink = await prisma.link.findUnique({
    where: { id },
    select: {
      slug: true,
      domain: {
        select: {
          hostString: true,
        },
      },
      slugAliases: {
        select: {
          slug: true,
        },
      },
    },
  });

  if (!existingLink) {
    return noStoreJson({ error: "Link not found." }, { status: 404 });
  }

  await prisma.link.delete({ where: { id } });

  try {
    await Promise.all([
      redis.del(`link:${existingLink.domain.hostString}:${existingLink.slug}`),
      ...existingLink.slugAliases.map((alias) => redis.del(`link:${existingLink.domain.hostString}:${alias.slug}`)),
    ]);
  } catch {
    // Cache cleanup is best-effort.
  }

  return noStoreJson({ ok: true });
}
