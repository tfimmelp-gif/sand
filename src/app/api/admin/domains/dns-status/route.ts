import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { resolve4, resolve6, resolveCname } from "node:dns/promises";

import { authOptions } from "@/lib/auth";
import { normalizeHost, isValidHostname } from "@/lib/domains";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unique(values: string[]) {
  return [...new Set(values)];
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden. Please log in as a super admin." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const host = normalizeHost(searchParams.get("domain") ?? "");

  if (!isValidHostname(host)) {
    return NextResponse.json({ error: "Enter a valid hostname." }, { status: 400 });
  }

  const expectedA = (process.env.PUBLIC_SERVER_IP ?? "").trim();
  const expectedCname = normalizeHost(process.env.PLATFORM_CNAME_TARGET ?? process.env.NEXT_PUBLIC_APP_DOMAIN ?? "");

  const [aResult, aaaaResult, cnameResult] = await Promise.allSettled([
    resolve4(host),
    resolve6(host),
    resolveCname(host),
  ]);

  const aRecords = aResult.status === "fulfilled" ? unique(aResult.value) : [];
  const aaaaRecords = aaaaResult.status === "fulfilled" ? unique(aaaaResult.value) : [];
  const cnameRecords = cnameResult.status === "fulfilled" ? unique(cnameResult.value.map(normalizeHost)) : [];
  const matchesA = expectedA ? aRecords.includes(expectedA) : false;
  const matchesCname = expectedCname ? cnameRecords.includes(expectedCname) : false;

  return NextResponse.json({
    domain: host,
    expectedA: expectedA || null,
    expectedCname: expectedCname || null,
    aRecords,
    aaaaRecords,
    cnameRecords,
    resolves: aRecords.length > 0 || aaaaRecords.length > 0 || cnameRecords.length > 0,
    pointsToServer: matchesA || matchesCname,
    recommendedRecord: host.split(".").length > 2 ? "CNAME or A" : "A",
  });
}
