CREATE TYPE "AutoRotationMode" AS ENUM ('SHORT', 'LONG');

ALTER TABLE "User" ADD COLUMN "autoRotationEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "autoRotationMode" "AutoRotationMode" NOT NULL DEFAULT 'SHORT';
ALTER TABLE "User" ADD COLUMN "autoRotationIntervalHours" INTEGER;
ALTER TABLE "User" ADD COLUMN "nextAutoRotationAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "lastAutoRotationAt" TIMESTAMP(3);

CREATE TABLE "LinkMetricSummary" (
  "linkId" TEXT NOT NULL,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "pageViews" INTEGER NOT NULL DEFAULT 0,
  "formSubmissions" INTEGER NOT NULL DEFAULT 0,
  "botVisits" INTEGER NOT NULL DEFAULT 0,
  "highRiskEvents" INTEGER NOT NULL DEFAULT 0,
  "uniqueIps" INTEGER NOT NULL DEFAULT 0,
  "lastVisitAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LinkMetricSummary_pkey" PRIMARY KEY ("linkId")
);

CREATE INDEX "User_autoRotationEnabled_nextAutoRotationAt_idx" ON "User"("autoRotationEnabled", "nextAutoRotationAt");
CREATE INDEX "Link_userId_status_idx" ON "Link"("userId", "status");
CREATE INDEX "Link_domainId_status_idx" ON "Link"("domainId", "status");
CREATE INDEX "LinkSlugAlias_domainId_slug_expiresAt_idx" ON "LinkSlugAlias"("domainId", "slug", "expiresAt");
CREATE INDEX "LinkMetricSummary_lastVisitAt_idx" ON "LinkMetricSummary"("lastVisitAt");
CREATE INDEX "ClickLog_linkId_isBot_timestamp_idx" ON "ClickLog"("linkId", "isBot", "timestamp");
CREATE INDEX "ClickLog_linkId_riskScore_timestamp_idx" ON "ClickLog"("linkId", "riskScore", "timestamp");
CREATE INDEX "PageActivity_linkId_eventType_timestamp_idx" ON "PageActivity"("linkId", "eventType", "timestamp");
CREATE INDEX "PageActivity_linkId_isBot_timestamp_idx" ON "PageActivity"("linkId", "isBot", "timestamp");
CREATE INDEX "PageActivity_linkId_riskScore_timestamp_idx" ON "PageActivity"("linkId", "riskScore", "timestamp");

ALTER TABLE "LinkMetricSummary" ADD CONSTRAINT "LinkMetricSummary_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Link"("id") ON DELETE CASCADE ON UPDATE CASCADE;
