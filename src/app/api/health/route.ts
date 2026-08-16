import { NextResponse } from "next/server";

import { productionEnvReport } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

export async function GET() {
  const checks = {
    app: true,
    database: false,
    redis: false,
    env: productionEnvReport(),
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch {
    checks.database = false;
  }

  try {
    await redis.set("health:ping", "ok", { ex: 30 });
    checks.redis = (await redis.get("health:ping")) === "ok";
  } catch {
    checks.redis = false;
  }

  const ok = checks.app && checks.database && checks.redis && checks.env.every((entry) => entry.ok);

  return NextResponse.json(checks, {
    status: ok ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
