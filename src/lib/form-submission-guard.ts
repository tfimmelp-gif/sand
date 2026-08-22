import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { redis } from "@/lib/redis";

export const FORM_SUBMISSION_COOLDOWN_SECONDS = 10 * 60;

type SubmissionGuardResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export async function checkFormSubmissionAllowed(linkId: string, ipAddress: string): Promise<SubmissionGuardResult> {
  // Do not treat every visitor whose address could not be resolved as the same person.
  if (!ipAddress || ipAddress === "Unknown") {
    return { allowed: true };
  }

  const now = Date.now();
  const cooldownMs = FORM_SUBMISSION_COOLDOWN_SECONDS * 1_000;
  const recentSubmission = await prisma.pageActivity.findFirst({
    where: {
      linkId,
      eventType: "form_submit",
      ipAddress,
      timestamp: { gte: new Date(now - cooldownMs) },
    },
    orderBy: { timestamp: "desc" },
    select: { timestamp: true },
  });

  if (recentSubmission) {
    const retryAfterSeconds = Math.max(
      Math.ceil((recentSubmission.timestamp.getTime() + cooldownMs - now) / 1_000),
      1,
    );
    return { allowed: false, retryAfterSeconds };
  }

  const key = `form-submission:${linkId}:${ipAddress}`;

  try {
    const acquired = await redis.set(key, "1", {
      ex: FORM_SUBMISSION_COOLDOWN_SECONDS,
      nx: true,
    });

    if (acquired === "OK") {
      return { allowed: true };
    }

    const ttl = await redis.ttl(key);
    return {
      allowed: false,
      retryAfterSeconds: ttl > 0 ? ttl : FORM_SUBMISSION_COOLDOWN_SECONDS,
    };
  } catch (error) {
    console.warn("form submission Redis guard unavailable; using process-local fallback", { linkId, error });
    const localLimit = checkRateLimit(key, 1, cooldownMs);
    return localLimit.allowed
      ? { allowed: true }
      : {
          allowed: false,
          retryAfterSeconds: Math.max(Math.ceil((localLimit.resetAt - now) / 1_000), 1),
        };
  }
}