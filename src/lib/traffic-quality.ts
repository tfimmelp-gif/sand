const BOT_USER_AGENT_PATTERNS = [
  "ahrefs",
  "bingbot",
  "bot",
  "crawler",
  "curl",
  "facebookexternalhit",
  "headless",
  "httpclient",
  "lighthouse",
  "python-requests",
  "scan",
  "scrapy",
  "semrush",
  "spider",
  "wget",
];

const DATACENTER_HINTS = ["amazonaws", "azure", "digitalocean", "googleusercontent", "linode", "ovh"];

export type TrafficQuality = {
  botReason: string;
  isBot: boolean;
  riskScore: number;
};

export function evaluateTrafficQuality(input: {
  accept?: string | null;
  country?: string | null;
  ipAddress?: string | null;
  referrer?: string | null;
  userAgent?: string | null;
}) {
  const reasons: string[] = [];
  let score = 0;
  const userAgent = (input.userAgent || "").toLowerCase();
  const accept = input.accept || "";
  const ipAddress = input.ipAddress || "";

  if (!userAgent) {
    score += 35;
    reasons.push("missing user-agent");
  }

  const matchedPattern = BOT_USER_AGENT_PATTERNS.find((pattern) => userAgent.includes(pattern));
  if (matchedPattern) {
    score += matchedPattern === "bot" ? 35 : 45;
    reasons.push(`user-agent contains ${matchedPattern}`);
  }

  if (!accept) {
    score += 15;
    reasons.push("missing accept header");
  }

  if (accept && !accept.includes("text/html") && !accept.includes("*/*")) {
    score += 15;
    reasons.push("non-browser accept header");
  }

  if (ipAddress === "Unknown") {
    score += 10;
    reasons.push("unknown ip");
  }

  const datacenterHint = DATACENTER_HINTS.find((hint) => userAgent.includes(hint));
  if (datacenterHint) {
    score += 20;
    reasons.push(`datacenter hint ${datacenterHint}`);
  }

  const riskScore = Math.min(score, 100);

  return {
    botReason: reasons.join(", ") || "browser-like traffic",
    isBot: riskScore >= 45,
    riskScore,
  } satisfies TrafficQuality;
}

export function qualityLabel(riskScore: number) {
  if (riskScore >= 75) {
    return "High Risk";
  }

  if (riskScore >= 45) {
    return "Review";
  }

  return "Clean";
}
