import { promises as dns } from "dns";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { normalizeHost } from "@/lib/domains";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse("Unauthenticated", { status: 401 });
  }

  const { id } = await context.params;
  const domain = await prisma.domain.findFirst({
    where: {
      id,
      OR: [{ userId: session.user.id }, { isGlobal: true }],
    },
    select: {
      id: true,
      hostString: true,
      status: true,
    },
  });

  if (!domain) {
    return NextResponse.json({ error: "Domain not found." }, { status: 404 });
  }

  const platformHost = normalizeHost(process.env.NEXT_PUBLIC_APP_DOMAIN ?? "");

  if (!platformHost) {
    return NextResponse.json({ error: "NEXT_PUBLIC_APP_DOMAIN is not configured." }, { status: 500 });
  }

  try {
    const records = await dns.resolveCname(domain.hostString);
    const normalizedRecords = records.map(normalizeHost);
    const isVerified = normalizedRecords.includes(platformHost);

    if (!isVerified) {
      return NextResponse.json(
        {
          status: "PENDING",
          expected: platformHost,
          records: normalizedRecords,
        },
        { status: 400 },
      );
    }

    const updatedDomain = await prisma.domain.update({
      where: { id: domain.id },
      data: { status: "ACTIVE" },
      select: {
        id: true,
        hostString: true,
        status: true,
      },
    });

    return NextResponse.json({
      status: "ACTIVE",
      domain: updatedDomain,
      records: normalizedRecords,
    });
  } catch {
    await prisma.domain.update({
      where: { id: domain.id },
      data: { status: "PENDING" },
    });

    return NextResponse.json(
      {
        status: "PENDING",
        expected: platformHost,
        records: [],
      },
      { status: 400 },
    );
  }
}
