CREATE TABLE "LinkSlugAlias" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "linkId" TEXT NOT NULL,
  "domainId" TEXT NOT NULL,

  CONSTRAINT "LinkSlugAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LinkSlugAlias_domainId_slug_key" ON "LinkSlugAlias"("domainId", "slug");
CREATE INDEX "LinkSlugAlias_linkId_idx" ON "LinkSlugAlias"("linkId");
CREATE INDEX "LinkSlugAlias_expiresAt_idx" ON "LinkSlugAlias"("expiresAt");

ALTER TABLE "LinkSlugAlias" ADD CONSTRAINT "LinkSlugAlias_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Link"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LinkSlugAlias" ADD CONSTRAINT "LinkSlugAlias_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
