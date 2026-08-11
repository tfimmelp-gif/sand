import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { normalizeHost, isValidHostname } from "@/lib/domains";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse("Unauthenticated", { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      assignedDomain: {
        select: {
          id: true,
          hostString: true,
          status: true,
          isGlobal: true,
          createdAt: true,
        },
      },
    },
  });

  if (user?.assignedDomain) {
    return NextResponse.json([user.assignedDomain]);
  }

  return NextResponse.json([]);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse("Unauthenticated", { status: 401 });
  }

  const { hostString } = (await req.json()) as { hostString?: string };
  const normalizedHost = normalizeHost(hostString ?? "");

  if (!isValidHostname(normalizedHost)) {
    return NextResponse.json({ error: "Enter a valid hostname." }, { status: 400 });
  }

  try {
    const domain = await prisma.domain.create({
      data: {
        hostString: normalizedHost,
        userId: session.user.id,
        status: "PENDING",
      },
      select: {
        id: true,
        hostString: true,
        status: true,
        isGlobal: true,
        createdAt: true,
      },
    });

    return NextResponse.json(domain, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Domain is already registered." }, { status: 409 });
  }
}
