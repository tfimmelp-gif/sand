-- AlterTable
ALTER TABLE "ClickLog" ADD COLUMN     "botReason" TEXT,
ADD COLUMN     "isBot" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "riskScore" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PageActivity" ADD COLUMN     "botReason" TEXT,
ADD COLUMN     "isBot" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "riskScore" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "ClickLog_isBot_timestamp_idx" ON "ClickLog"("isBot", "timestamp");

-- CreateIndex
CREATE INDEX "PageActivity_isBot_timestamp_idx" ON "PageActivity"("isBot", "timestamp");
