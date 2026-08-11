export function parseUserAgent(userAgent = "") {
  const lower = userAgent.toLowerCase();

  const browser = lower.includes("edg")
    ? "Edge"
    : lower.includes("chrome")
      ? "Chrome"
      : lower.includes("firefox")
        ? "Firefox"
        : lower.includes("safari")
          ? "Safari"
          : "Unknown";

  const os = lower.includes("windows")
    ? "Windows"
    : lower.includes("mac os")
      ? "macOS"
      : lower.includes("android")
        ? "Android"
        : lower.includes("iphone") || lower.includes("ipad")
          ? "iOS"
          : lower.includes("linux")
            ? "Linux"
            : "Unknown";

  const device = lower.includes("mobile") || lower.includes("android") || lower.includes("iphone")
    ? "Mobile"
    : "Desktop";

  return { browser, os, device };
}

export function getRequestIp(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  return (
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    forwardedFor ||
    "Unknown"
  );
}

export function normalizeHost(host: string) {
  return host.toLowerCase().replace(/:\d+$/, "");
}
