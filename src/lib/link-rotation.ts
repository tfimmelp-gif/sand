import { LINK_ALIAS_TTL_SECONDS, linkAliasExpiresAt } from "@/lib/link-aliases";
import { generateSlug } from "@/lib/links";
import { clearLinkMetadataCache, primeLinkMetadataCache } from "@/lib/link-cache";
import { prisma } from "@/lib/prisma";

export const ROTATION_INTERVALS = [1, 6, 12, 24, 72, 168] as const;
export type RotationIntervalHours = (typeof ROTATION_INTERVALS)[number];

export function isValidRotationInterval(value: number) {
  return ROTATION_INTERVALS.includes(value as RotationIntervalHours);
}

export function nextRotationDate(intervalHours: number, now = new Date()) {
  return new Date(now.getTime() + intervalHours * 60 * 60 * 1000);
}

export async function rotateLinkPrefix(input: {
  linkId: string;
  mode: "SHORT" | "LONG";
  requestedSlug?: string;
  maxAttempts?: number;
}) {
  const existingLink = await prisma.link.findUnique({
    where: { id: input.linkId },
    include: {
      domain: { select: { hostString: true } },
    },
  });

  if (!existingLink) {
    return null;
  }

  const slugLength = input.mode === "LONG" ? 32 : 8;
  let nextSlug = input.requestedSlug ?? generateSlug(slugLength);
  const maxAttempts = input.requestedSlug ? 1 : input.maxAttempts ?? 8;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const updatedLink = await prisma.$transaction(async (tx) => {
        const aliasCollision = await tx.linkSlugAlias.findFirst({
          where: {
            domainId: existingLink.domainId,
            slug: nextSlug,
            expiresAt: { gt: new Date() },
          },
          select: { id: true },
        });

        if (aliasCollision) {
          throw new Error("Alias collision");
        }

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

        return tx.link.update({
          where: { id: existingLink.id },
          data: { slug: nextSlug },
          include: {
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

      await Promise.all([
        primeLinkMetadataCache(
          {
            linkId: existingLink.id,
            host: existingLink.domain.hostString,
            slug: existingLink.slug,
            canonicalSlug: updatedLink.slug,
            destinationUrl: existingLink.destinationUrl,
            indexPagePreset: existingLink.indexPagePreset,
            redirectSource: existingLink.redirectSource,
            expiresAt: existingLink.expiresAt?.toISOString() ?? null,
            status: existingLink.status,
          },
          LINK_ALIAS_TTL_SECONDS,
        ).catch(() => undefined),
        primeLinkMetadataCache({
          linkId: updatedLink.id,
          host: updatedLink.domain.hostString,
          slug: updatedLink.slug,
          canonicalSlug: updatedLink.slug,
          destinationUrl: updatedLink.destinationUrl,
          indexPagePreset: updatedLink.indexPagePreset,
          redirectSource: updatedLink.redirectSource,
          expiresAt: updatedLink.expiresAt?.toISOString() ?? null,
          status: updatedLink.status,
        }).catch(() => undefined),
      ]);

      return updatedLink;
    } catch {
      if (input.requestedSlug) {
        throw new Error("Slug collision occurred.");
      }

      nextSlug = generateSlug(slugLength);
    }
  }

  throw new Error("Could not generate an available slug.");
}

export async function clearLinkAndAliasCaches(input: { host: string; slug: string; aliases?: Array<{ slug: string }> }) {
  await Promise.all([
    clearLinkMetadataCache(input.host, input.slug),
    ...(input.aliases ?? []).map((alias) => clearLinkMetadataCache(input.host, alias.slug)),
  ]);
}
