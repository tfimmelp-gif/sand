import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";

import { checkRateLimit } from "@/lib/rate-limit";
import { getRequestIp, normalizeHost } from "@/lib/request-insights";

function pathnameToSlug(pathname: string) {
  return pathname
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\/index\.html$/i, "");
}

function pathnameToPageFile(pathname: string) {
  const cleanPath = pathname.replace(/^\/+/, "").replace(/\/+$/, "");
  const [slug, ...fileParts] = cleanPath.split("/");

  if (!slug || fileParts.length === 0) {
    return null;
  }

  return {
    slug,
    filePath: fileParts.join("/"),
  };
}

async function getCachedDestination(cacheKey: string) {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken || redisToken === "your_redis_token_here") {
    return null;
  }

  const response = await fetch(`${redisUrl}/get/${encodeURIComponent(cacheKey)}`, {
    headers: {
      Authorization: `Bearer ${redisToken}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { result?: string | null };
  return payload.result ?? null;
}

async function resolveDestination(url: URL, host: string, slug: string) {
  if (!process.env.INTERNAL_API_SECRET) {
    return null;
  }

  const response = await fetch(`${url.origin}/api/internal/resolve-link`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.INTERNAL_API_SECRET}`,
    },
    body: JSON.stringify({ host, slug }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    found?: boolean;
    destinationUrl?: string;
  };

  return payload.found ? payload.destinationUrl ?? null : null;
}

async function renderIndexPage(url: URL, host: string, slug: string, filePath = "index.html") {
  if (!process.env.INTERNAL_API_SECRET) {
    return null;
  }

  const response = await fetch(`${url.origin}/api/internal/render-index`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.INTERNAL_API_SECRET}`,
    },
    body: JSON.stringify({ host, slug, filePath }),
  });

  if (!response.ok) {
    return null;
  }

  return {
    body: await response.text(),
    contentType: response.headers.get("content-type") || "text/html; charset=utf-8",
  };
}

function logClick(event: NextFetchEvent, url: URL, request: NextRequest, host: string, slug: string) {
  if (!process.env.INTERNAL_API_SECRET) {
    return;
  }

  const analyticsPayload = {
    host,
    slug,
    timestamp: new Date().toISOString(),
    userAgent: request.headers.get("user-agent"),
    country: request.headers.get("cf-ipcountry") || "Unknown",
    city: request.headers.get("x-vercel-ip-city") || "Unknown",
    referrer: request.headers.get("referer") || "Direct",
    ipAddress: getRequestIp(request.headers),
  };

  event.waitUntil(
    fetch(`${url.origin}/api/internal/log-click`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.INTERNAL_API_SECRET}`,
      },
      body: JSON.stringify(analyticsPayload),
    }).catch(() => undefined),
  );
}

function logPageActivity(
  event: NextFetchEvent,
  url: URL,
  request: NextRequest,
  host: string,
  slug: string,
  eventType: string,
) {
  if (!process.env.INTERNAL_API_SECRET) {
    return;
  }

  const payload = {
    host,
    slug,
    eventType,
    path: url.pathname,
    timestamp: new Date().toISOString(),
    userAgent: request.headers.get("user-agent"),
    country: request.headers.get("cf-ipcountry") || "Unknown",
    city: request.headers.get("x-vercel-ip-city") || "Unknown",
    referrer: request.headers.get("referer") || "Direct",
    ipAddress: getRequestIp(request.headers),
  };

  event.waitUntil(
    fetch(`${url.origin}/api/internal/log-page-activity`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.INTERNAL_API_SECRET}`,
      },
      body: JSON.stringify(payload),
    }).catch(() => undefined),
  );
}

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const url = new URL(request.url);
  const host = normalizeHost(request.headers.get("host") || "");
  const appDomain = normalizeHost(process.env.NEXT_PUBLIC_APP_DOMAIN || "");
  const isIndexHtmlAlias = /\/index\.html$/i.test(url.pathname);
  const pageFile = pathnameToPageFile(url.pathname);
  const slug = pathnameToSlug(url.pathname);
  const ipAddress = getRequestIp(request.headers);

  if (
    !host ||
    host === appDomain ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/_next") ||
    (url.pathname.includes(".") && !isIndexHtmlAlias && !pageFile)
  ) {
    return NextResponse.next();
  }

  const rateLimitKey = `traffic:${host}:${slug || pageFile?.slug || "root"}:${ipAddress}`;
  const rateLimit = checkRateLimit(rateLimitKey, 90, 60_000);

  if (!rateLimit.allowed) {
    return new NextResponse("Too many requests", {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(Math.ceil((rateLimit.resetAt - Date.now()) / 1000), 1)),
      },
    });
  }

  if (pageFile && !isIndexHtmlAlias) {
    const file = await renderIndexPage(url, host, pageFile.slug, pageFile.filePath);

    if (file) {
      if (file.contentType.toLowerCase().includes("text/html")) {
        logPageActivity(event, url, request, host, pageFile.slug, "page_view");
      }

      return new NextResponse(file.body, {
        headers: {
          "Content-Type": file.contentType,
          "Cache-Control": "no-store",
        },
      });
    }

    return new NextResponse("File not found", { status: 404 });
  }

  if (!slug) {
    return NextResponse.redirect(`https://${appDomain || host}`);
  }

  if (isIndexHtmlAlias) {
    const html = await renderIndexPage(url, host, slug);

    if (html) {
      logClick(event, url, request, host, slug);
      logPageActivity(event, url, request, host, slug, "page_view");
      return new NextResponse(html.body, {
        headers: {
          "Content-Type": html.contentType,
          "Cache-Control": "no-store",
        },
      });
    }

    return new NextResponse("Page not found", { status: 404 });
  }

  const cacheKey = `link:${host}:${slug}`;
  const cachedDestination = await getCachedDestination(cacheKey);

  if (cachedDestination) {
    logClick(event, url, request, host, slug);
    return NextResponse.redirect(cachedDestination, 302);
  }

  const resolvedDestination = await resolveDestination(url, host, slug);

  if (resolvedDestination) {
    logClick(event, url, request, host, slug);
    return NextResponse.redirect(resolvedDestination, 302);
  }

  return new NextResponse("Link not found", { status: 404 });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
