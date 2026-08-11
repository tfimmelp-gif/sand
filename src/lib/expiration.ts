export type ExpiryBundle = "none" | "1w" | "2w" | "1m" | "3m";

const DAY_MS = 24 * 60 * 60 * 1000;

export function expiryFromBundle(bundle: ExpiryBundle | string | undefined, now = new Date()) {
  if (!bundle || bundle === "none") {
    return null;
  }

  const base = new Date(now);

  if (bundle === "1w") {
    return new Date(base.getTime() + 7 * DAY_MS);
  }

  if (bundle === "2w") {
    return new Date(base.getTime() + 14 * DAY_MS);
  }

  if (bundle === "1m") {
    base.setUTCMonth(base.getUTCMonth() + 1);
    return base;
  }

  if (bundle === "3m") {
    base.setUTCMonth(base.getUTCMonth() + 3);
    return base;
  }

  return null;
}

export function endOfUtcDay(dateInput: string | undefined) {
  if (!dateInput) {
    return null;
  }

  const date = new Date(`${dateInput}T23:59:59.999Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseExpiryInput(input: {
  expiresAt?: string | null;
  expiryBundle?: string | null;
}) {
  if (input.expiryBundle) {
    return expiryFromBundle(input.expiryBundle);
  }

  if (input.expiresAt === null || input.expiresAt === "") {
    return null;
  }

  return endOfUtcDay(input.expiresAt ?? undefined);
}

export function isExpired(value: Date | string | null | undefined, now = new Date()) {
  if (!value) {
    return false;
  }

  const date = value instanceof Date ? value : new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() <= now.getTime();
}

export function dateInputValue(value: string | Date | null | undefined) {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export function formatExpiry(value: string | Date | null | undefined) {
  if (!value) {
    return "No expiry";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid expiry";
  }

  return date.getTime() <= Date.now() ? `Expired ${date.toLocaleDateString()}` : `Expires ${date.toLocaleDateString()}`;
}

export function activeDateWhere(field: string, now = new Date()) {
  return {
    OR: [{ [field]: null }, { [field]: { gt: now } }],
  };
}
