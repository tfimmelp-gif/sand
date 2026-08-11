import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";

import { authOptions } from "@/lib/auth";
import { parseExpiryInput } from "@/lib/expiration";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "SUPER_ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      assignedDomainId: true,
      assignedDomainExpiresAt: true,
      tenantAccessActive: true,
      tenantAccessExpiresAt: true,
      assignedDomain: {
        select: {
          id: true,
          hostString: true,
          status: true,
        },
      },
      _count: {
        select: {
          links: true,
          domains: true,
        },
      },
    },
  });

  return NextResponse.json(users);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "SUPER_ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { userId, assignedDomainId, assignedDomainExpiresAt, assignedDomainExpiryBundle, tenantAccessActive, tenantAccessExpiresAt, tenantAccessBundle } = (await req.json()) as {
    userId?: string;
    assignedDomainId?: string | null;
    assignedDomainExpiresAt?: string | null;
    assignedDomainExpiryBundle?: string | null;
    tenantAccessActive?: boolean;
    tenantAccessExpiresAt?: string | null;
    tenantAccessBundle?: string | null;
  };

  if (!userId) {
    return NextResponse.json({ error: "Tenant user is required." }, { status: 400 });
  }

  if (assignedDomainId) {
    const domain = await prisma.domain.findFirst({
      where: {
        id: assignedDomainId,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    if (!domain) {
      return NextResponse.json({ error: "Choose an active domain." }, { status: 400 });
    }
  }

  const data: {
    assignedDomainId: string | null;
    assignedDomainExpiresAt?: Date | null;
    tenantAccessActive?: boolean;
    tenantAccessExpiresAt?: Date | null;
  } = {
    assignedDomainId: assignedDomainId || null,
  };

  if (!assignedDomainId || assignedDomainExpiresAt !== undefined || assignedDomainExpiryBundle !== undefined) {
    data.assignedDomainExpiresAt = assignedDomainId
      ? parseExpiryInput({ expiresAt: assignedDomainExpiresAt, expiryBundle: assignedDomainExpiryBundle })
      : null;
  }

  if (typeof tenantAccessActive === "boolean") {
    data.tenantAccessActive = tenantAccessActive;
  }

  if (tenantAccessExpiresAt !== undefined || tenantAccessBundle !== undefined) {
    data.tenantAccessExpiresAt = parseExpiryInput({ expiresAt: tenantAccessExpiresAt, expiryBundle: tenantAccessBundle });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      email: true,
      role: true,
      assignedDomainId: true,
      assignedDomainExpiresAt: true,
      tenantAccessActive: true,
      tenantAccessExpiresAt: true,
      assignedDomain: {
        select: {
          id: true,
          hostString: true,
          status: true,
        },
      },
    },
  });

  return NextResponse.json(user);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "SUPER_ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { email, password } = (await req.json()) as {
    email?: string;
    password?: string;
  };

  if (!email || !password || password.length < 8) {
    return NextResponse.json({ error: "Email and an 8+ character password are required." }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  try {
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash: hashedPassword,
        role: "WORKSPACE_USER",
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed payload processing" }, { status: 400 });
  }
}
