import { getCachedLinkMetadata, primeLinkMetadataCache, type CachedLinkMetadata } from "@/lib/link-cache";
import { prisma } from "@/lib/prisma";
import { publicLinkAccessWhere } from "@/lib/tenant-access";

export function normalizePublicSlug(slug: string) {
  return slug
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\/index\.html$/i, "");
}

export async function resolvePublicLinkMetadata(host: string, slug: string) {
  const normalizedSlug = normalizePublicSlug(slug);
  const cached = await getCachedLinkMetadata(host, normalizedSlug).catch(() => null);

  if (cached && isCachedLinkActive(cached)) {
    return cached;
  }

  let link = await prisma.link.findFirst({
    where: {
      slug: normalizedSlug,
      ...publicLinkAccessWhere(host),
    },
    select: {
      id: true,
      slug: true,
      destinationUrl: true,
      indexPagePreset: true,
      redirectSource: true,
      expiresAt: true,
      status: true,
      domain: {
        select: {
          hostString: true,
        },
      },
    },
  });

  let requestedSlug = normalizedSlug;

  if (!link && normalizedSlug) {
    const alias = await prisma.linkSlugAlias.findFirst({
      where: {
        slug: normalizedSlug,
        expiresAt: {
          gt: new Date(),
        },
        domain: {
          hostString: host,
          status: "ACTIVE",
        },
        link: publicLinkAccessWhere(host),
      },
      select: {
        link: {
          select: {
            id: true,
            slug: true,
            destinationUrl: true,
            indexPagePreset: true,
            redirectSource: true,
            expiresAt: true,
            status: true,
            domain: {
              select: {
                hostString: true,
              },
            },
          },
        },
      },
    });

    link = alias?.link ?? null;
    requestedSlug = normalizedSlug;
  }

  if (!link) {
    return null;
  }

  const metadata: CachedLinkMetadata = {
    linkId: link.id,
    host: link.domain.hostString,
    slug: requestedSlug || link.slug,
    canonicalSlug: link.slug,
    destinationUrl: link.destinationUrl,
    indexPagePreset: link.indexPagePreset,
    redirectSource: link.redirectSource,
    expiresAt: link.expiresAt?.toISOString() ?? null,
    status: link.status,
  };

  await primeLinkMetadataCache(metadata).catch(() => undefined);
  return metadata;
}

function isCachedLinkActive(link: CachedLinkMetadata) {
  if (link.status !== "ACTIVE") {
    return false;
  }

  if (!link.expiresAt) {
    return true;
  }

  const expiresAt = new Date(link.expiresAt);
  return Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() > Date.now();
}
