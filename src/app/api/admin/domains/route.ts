import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { normalizeHost, isValidHostname } from "@/lib/domains";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden. Please log in as a super admin." }, { status: 403 });
  }

  const domains = await prisma.domain.findMany({
    where: { isGlobal: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      hostString: true,
      status: true,
      isGlobal: true,
      createdAt: true,
      _count: {
        select: {
          links: true,
        },
      },
      assignedUsers: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  return NextResponse.json(domains);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden. Please log in as a super admin." }, { status: 403 });
  }

  const { hostString, status = "ACTIVE" } = (await req.json()) as {
    hostString?: string;
    status?: "ACTIVE" | "PENDING";
  };
  const normalizedHost = normalizeHost(hostString ?? "");

  if (!isValidHostname(normalizedHost)) {
    return NextResponse.json({ error: "Enter a valid hostname." }, { status: 400 });
  }

  try {
    const domain = await prisma.domain.create({
      data: {
        hostString: normalizedHost,
        isGlobal: true,
        status,
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "That global domain is already registered." }, { status: 409 });
    }

    return NextResponse.json({ error: "Domain is already registered." }, { status: 409 });
  }
}
