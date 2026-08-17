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

function inferPageFileFromReferer(request: NextRequest, host: string, pathname: string) {
  const cleanPath = pathname.replace(/^\/+/, "").replace(/\/+$/, "");

  if (!cleanPath || cleanPath.includes("..") || !cleanPath.includes(".")) {
    return null;
  }

  const referer = request.headers.get("referer");
  if (!referer) {
    return null;
  }

  try {
    const refererUrl = new URL(referer);
    if (normalizeHost(refererUrl.host) !== host) {
      return null;
    }

    const refererPageFile = pathnameToPageFile(refererUrl.pathname);
    const slug = refererPageFile?.slug ?? pathnameToSlug(refererUrl.pathname);

    return slug ? { slug, filePath: cleanPath } : null;
  } catch {
    return null;
  }
}

function rootPresetFilePath(pathname: string) {
  const cleanPath = pathname.replace(/^\/+/, "").replace(/\/+$/, "");

  if (!cleanPath || cleanPath.includes("/") || cleanPath.includes("..") || !cleanPath.includes(".")) {
    return null;
  }

  return cleanPath;
}

function lastSlugCookieName(host: string) {
  return `lp_last_slug_${host.replace(/[^a-z0-9]/gi, "_").slice(0, 80)}`;
}

function rememberedSlug(request: NextRequest, host: string) {
  const value = request.cookies.get(lastSlugCookieName(host))?.value;

  if (!value || value.includes("/") || value.includes("..")) {
    return null;
  }

  return value;
}

function redirectBarePresetFileToRememberedSlug(request: NextRequest, url: URL, host: string, filePath: string) {
  const inferredFromReferer = inferPageFileFromReferer(request, host, url.pathname);
  const inferredSlug = inferredFromReferer?.slug ?? rememberedSlug(request, host);

  if (!inferredSlug) {
    return null;
  }

  const redirectUrl = new URL(url);
  redirectUrl.pathname = filePath.toLowerCase() === "index.html" ? `/${inferredSlug}` : `/${inferredSlug}/${filePath}`;
  return NextResponse.redirect(redirectUrl, 302);
}

function internalOrigin(url: URL) {
  return (
    process.env.MIDDLEWARE_INTERNAL_ORIGIN ||
    process.env.INTERNAL_APP_ORIGIN ||
    (process.env.NODE_ENV === "production" ? "http://app:3000" : url.origin)
  );
}

async function resolveDestination(url: URL, host: string, slug: string) {
  if (!process.env.INTERNAL_API_SECRET) {
    return null;
  }

  const response = await fetch(`${internalOrigin(url)}/api/internal/resolve-link`, {
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

  const response = await fetch(`${internalOrigin(url)}/api/internal/render-index`, {
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
    body: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") || "text/html; charset=utf-8",
    linkSlug: response.headers.get("x-link-slug") || slug,
  };
}

function cleanPrefixRedirect(url: URL, slug: string) {
  const redirectUrl = new URL(url);
  redirectUrl.pathname = `/${slug}`;
  return NextResponse.redirect(redirectUrl, 302);
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
    (async () => {
      try {
        const response = await fetch(`${internalOrigin(url)}/api/internal/log-click`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.INTERNAL_API_SECRET}`,
          },
          body: JSON.stringify(analyticsPayload),
        });

        if (!response.ok) {
          console.error("middleware log-click failed", {
            host,
            slug,
            status: response.status,
            body: await response.text().catch(() => ""),
          });
        }
      } catch (error) {
        console.error("middleware log-click request failed", { host, slug, error });
      }
    })(),
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
    (async () => {
      try {
        const response = await fetch(`${internalOrigin(url)}/api/internal/log-page-activity`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.INTERNAL_API_SECRET}`,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          console.error("middleware log-page-activity failed", {
            host,
            slug,
            eventType,
            status: response.status,
            body: await response.text().catch(() => ""),
          });
        }
      } catch (error) {
        console.error("middleware log-page-activity request failed", { host, slug, eventType, error });
      }
    })(),
  );
}

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const url = new URL(request.url);
  const host = normalizeHost(request.headers.get("host") || "");
  const appDomain = normalizeHost(process.env.NEXT_PUBLIC_APP_DOMAIN || "");
  const barePresetFile = rootPresetFilePath(url.pathname);
  const barePresetFileRedirect = barePresetFile
    ? redirectBarePresetFileToRememberedSlug(request, url, host, barePresetFile)
    : null;
  const pageFile =
    pathnameToPageFile(url.pathname) ??
    inferPageFileFromReferer(request, host, url.pathname) ??
    (barePresetFile ? { slug: "", filePath: barePresetFile } : null);
  const slug = pathnameToSlug(url.pathname);
  const ipAddress = getRequestIp(request.headers);

  if (
    host === appDomain &&
    (url.pathname === "/login" ||
      url.pathname === "/admin/login" ||
      url.pathname.startsWith("/dashboard") ||
      url.pathname.startsWith("/admin"))
  ) {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  }

  if (
    !host ||
    host === appDomain ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/_next") ||
    (url.pathname.includes(".") && !pageFile)
  ) {
    return NextResponse.next();
  }

  if (barePresetFileRedirect) {
    return barePresetFileRedirect;
  }

  if (pageFile?.filePath.toLowerCase() === "index.html") {
    const cleanUrl = new URL(url);
    cleanUrl.pathname = `/${pageFile.slug}`;
    return NextResponse.redirect(cleanUrl, 302);
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

  if (pageFile) {
    const file = await renderIndexPage(url, host, pageFile.slug, pageFile.filePath);

    if (file) {
      if (file.contentType.toLowerCase().includes("text/html")) {
        if (pageFile.filePath.toLowerCase() === "index.html") {
          logClick(event, url, request, host, file.linkSlug);
        }
        logPageActivity(event, url, request, host, file.linkSlug, "page_view");
      }

      const response = new NextResponse(file.body, {
        headers: {
          "Content-Type": file.contentType,
          "Cache-Control": "no-store",
        },
      });

      if (file.contentType.toLowerCase().includes("text/html") && file.linkSlug) {
        response.cookies.set(lastSlugCookieName(host), file.linkSlug, {
          httpOnly: true,
          maxAge: 60 * 60,
          path: "/",
          sameSite: "lax",
        });
      }

      return response;
    }

    return new NextResponse("File not found", { status: 404 });
  }

  if (!slug) {
    return NextResponse.redirect(`https://${appDomain || host}`);
  }

  const html = await renderIndexPage(url, host, slug);

  if (html) {
    logClick(event, url, request, host, slug);
    logPageActivity(event, url, request, host, slug, "page_view");
    const response = new NextResponse(html.body, {
      headers: {
        "Content-Type": html.contentType,
        "Cache-Control": "no-store",
      },
    });

    response.cookies.set(lastSlugCookieName(host), html.linkSlug || slug, {
      httpOnly: true,
      maxAge: 60 * 60,
      path: "/",
      sameSite: "lax",
    });

    return response;
  }

  if (url.search && !url.pathname.includes(".")) {
    const fallbackHome = await renderIndexPage(url, host, "");
    if (fallbackHome?.linkSlug) {
      return cleanPrefixRedirect(url, fallbackHome.linkSlug);
    }
  }

  const lastKnownSlug = rememberedSlug(request, host);
  if (lastKnownSlug && lastKnownSlug !== slug) {
    return cleanPrefixRedirect(url, lastKnownSlug);
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
