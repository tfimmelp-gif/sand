import { prisma } from "@/lib/prisma";

export const LINK_ALIAS_TTL_SECONDS = 7 * 24 * 60 * 60;

export function linkAliasExpiresAt(now = new Date()) {
  return new Date(now.getTime() + LINK_ALIAS_TTL_SECONDS * 1000);
}

export function activeAliasWhere(now = new Date()) {
  return {
    expiresAt: {
      gt: now,
    },
  };
}

export async function activeSlugAliasExists(domainId: string, slug: string, now = new Date()) {
  const alias = await prisma.linkSlugAlias.findFirst({
    where: {
      domainId,
      slug,
      ...activeAliasWhere(now),
    },
    select: {
      id: true,
    },
  });

  return Boolean(alias);
}
