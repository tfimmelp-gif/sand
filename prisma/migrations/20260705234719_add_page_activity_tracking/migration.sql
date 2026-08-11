-- AlterTable
ALTER TABLE "ClickLog" ADD COLUMN     "ipAddress" TEXT NOT NULL DEFAULT 'Unknown';

-- CreateTable
CREATE TABLE "PageActivity" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "path" TEXT NOT NULL DEFAULT '/',
    "ipAddress" TEXT NOT NULL DEFAULT 'Unknown',
    "country" TEXT NOT NULL DEFAULT 'Unknown',
    "city" TEXT NOT NULL DEFAULT 'Unknown',
    "browser" TEXT NOT NULL DEFAULT 'Unknown',
    "os" TEXT NOT NULL DEFAULT 'Unknown',
    "device" TEXT NOT NULL DEFAULT 'Unknown',
    "referrer" TEXT NOT NULL DEFAULT 'Direct',
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PageActivity_linkId_timestamp_idx" ON "PageActivity"("linkId", "timestamp");

-- CreateIndex
CREATE INDEX "PageActivity_eventType_timestamp_idx" ON "PageActivity"("eventType", "timestamp");

-- AddForeignKey
ALTER TABLE "PageActivity" ADD CONSTRAINT "PageActivity_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Link"("id") ON DELETE CASCADE ON UPDATE CASCADE;
