ALTER TABLE "User" ADD COLUMN "assignedDomainExpiresAt" TIMESTAMP(3);

ALTER TABLE "User" ADD COLUMN "tenantAccessActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "User" ADD COLUMN "tenantAccessExpiresAt" TIMESTAMP(3);

ALTER TABLE "Link" ADD COLUMN "expiresAt" TIMESTAMP(3);

CREATE INDEX "User_assignedDomainExpiresAt_idx" ON "User"("assignedDomainExpiresAt");

CREATE INDEX "User_tenantAccessExpiresAt_idx" ON "User"("tenantAccessExpiresAt");

CREATE INDEX "Link_expiresAt_idx" ON "Link"("expiresAt");
