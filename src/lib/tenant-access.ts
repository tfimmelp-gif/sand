import { prisma } from "@/lib/prisma";
import { isExpired } from "@/lib/expiration";

export function tenantAccessWhere(now = new Date()) {
  return {
    tenantAccessActive: true,
    OR: [{ tenantAccessExpiresAt: null }, { tenantAccessExpiresAt: { gt: now } }],
  };
}

export function assignedDomainAccessWhere(now = new Date()) {
  return {
    assignedDomainId: { not: null },
    OR: [{ assignedDomainExpiresAt: null }, { assignedDomainExpiresAt: { gt: now } }],
  };
}

export function linkAccessWhere(now = new Date()) {
  return {
    status: "ACTIVE" as const,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    user: {
      AND: [tenantAccessWhere(now), assignedDomainAccessWhere(now)],
    },
  };
}

export function publicLinkAccessWhere(host: string, now = new Date()) {
  return {
    ...linkAccessWhere(now),
    domain: {
      hostString: host,
      status: "ACTIVE" as const,
    },
    user: {
      AND: [
        tenantAccessWhere(now),
        assignedDomainAccessWhere(now),
        {
          assignedDomain: {
            hostString: host,
            status: "ACTIVE" as const,
          },
        },
      ],
    },
  };
}

export async function getTenantAccess(userId: string) {
  const tenant = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      tenantAccessActive: true,
      tenantAccessExpiresAt: true,
      assignedDomainId: true,
      assignedDomainExpiresAt: true,
    },
  });

  if (!tenant) {
    return {
      allowed: false,
      reason: "Tenant not found.",
    };
  }

  if (tenant.role !== "WORKSPACE_USER") {
    return {
      allowed: true,
      reason: null,
    };
  }

  if (!tenant.tenantAccessActive) {
    return {
      allowed: false,
      reason: "Tenant access is inactive. Ask the admin to approve a new access bundle.",
    };
  }

  if (isExpired(tenant.tenantAccessExpiresAt)) {
    return {
      allowed: false,
      reason: "Tenant access has expired. Ask the admin to approve a new access bundle.",
    };
  }

  return {
    allowed: true,
    reason: null,
  };
}
