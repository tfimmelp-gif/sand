import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.SUPER_ADMIN_PASSWORD ?? "change-this-temporary-password";
  const tenantEmail = process.env.TENANT_EMAIL ?? "tenant@firesender.com";
  const tenantPassword = process.env.TENANT_PASSWORD ?? "Tenant2026@";

  const passwordHash = await bcrypt.hash(password, 12);
  const tenantPasswordHash = await bcrypt.hash(tenantPassword, 12);

  await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: Role.SUPER_ADMIN,
    },
    create: {
      email,
      passwordHash,
      role: Role.SUPER_ADMIN,
    },
  });

  console.log(`Seeded SUPER_ADMIN user: ${email}`);

  await prisma.user.upsert({
    where: { email: tenantEmail },
    update: {
      passwordHash: tenantPasswordHash,
      role: Role.WORKSPACE_USER,
    },
    create: {
      email: tenantEmail,
      passwordHash: tenantPasswordHash,
      role: Role.WORKSPACE_USER,
    },
  });

  console.log(`Seeded WORKSPACE_USER tenant: ${tenantEmail}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
