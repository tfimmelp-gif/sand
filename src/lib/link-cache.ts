import { redis } from "@/lib/redis";

export const LINK_CACHE_TTL_SECONDS = 60 * 60 * 24;

export type CachedLinkMetadata = {
  linkId: string;
  host: string;
  slug: string;
  canonicalSlug: string;
  destinationUrl: string;
  indexPagePreset: string;
  redirectSource: "ADMIN_DESTINATION" | "PRESET_CONTROLLED";
  expiresAt: string | null;
  status: "ACTIVE" | "PAUSED" | "BROKEN" | "PENDING";
};

export function linkCacheKey(host: string, slug: string) {
  return `link-meta:${host}:${slug}`;
}

export function legacyDestinationCacheKey(host: string, slug: string) {
  return `link:${host}:${slug}`;
}

export async function getCachedLinkMetadata(host: string, slug: string) {
  const cached = await redis.get<string | CachedLinkMetadata>(linkCacheKey(host, slug));

  if (!cached) {
    return null;
  }

  if (typeof cached === "object") {
    return cached;
  }

  try {
    return JSON.parse(cached) as CachedLinkMetadata;
  } catch {
    return null;
  }
}

export async function primeLinkMetadataCache(input: CachedLinkMetadata, ttlSeconds = LINK_CACHE_TTL_SECONDS) {
  const payload = JSON.stringify(input);

  await Promise.all([
    redis.set(linkCacheKey(input.host, input.slug), payload, { ex: ttlSeconds }),
    redis.set(legacyDestinationCacheKey(input.host, input.slug), input.destinationUrl, { ex: ttlSeconds }),
  ]);
}

export async function clearLinkMetadataCache(host: string, slug: string) {
  await Promise.all([redis.del(linkCacheKey(host, slug)), redis.del(legacyDestinationCacheKey(host, slug))]);
}
