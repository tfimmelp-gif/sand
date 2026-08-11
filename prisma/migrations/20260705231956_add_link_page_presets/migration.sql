-- AlterTable
ALTER TABLE "Link" ADD COLUMN     "indexPagePreset" TEXT NOT NULL DEFAULT 'minimal';

-- CreateTable
CREATE TABLE "LinkPagePreset" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkPagePreset_pkey" PRIMARY KEY ("key")
);
