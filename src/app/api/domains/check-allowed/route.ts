import { NextResponse } from "next/server";

import { normalizeHost, isValidHostname } from "@/lib/domains";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawDomain = searchParams.get("domain");

  if (!rawDomain) {
    return new NextResponse("Missing domain parameter", { status: 400 });
  }

  const hostString = normalizeHost(rawDomain);

  if (!isValidHostname(hostString)) {
    return new NextResponse("Invalid domain parameter", { status: 400 });
  }

  const domain = await prisma.domain.findUnique({
    where: { hostString },
    select: { status: true },
  });

  if (domain && (domain.status === "ACTIVE" || domain.status === "PENDING")) {
    return new NextResponse("Allowed", { status: 200 });
  }

  return new NextResponse("Not Allowed", { status: 404 });
}
