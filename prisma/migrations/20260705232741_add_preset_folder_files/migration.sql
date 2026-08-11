/*
  Warnings:

  - Added the required column `folderPath` to the `LinkPagePreset` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "LinkPagePreset" ADD COLUMN     "folderPath" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "LinkPagePresetFile" (
    "id" TEXT NOT NULL,
    "presetKey" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkPagePresetFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LinkPagePresetFile_presetKey_filePath_key" ON "LinkPagePresetFile"("presetKey", "filePath");

-- AddForeignKey
ALTER TABLE "LinkPagePresetFile" ADD CONSTRAINT "LinkPagePresetFile_presetKey_fkey" FOREIGN KEY ("presetKey") REFERENCES "LinkPagePreset"("key") ON DELETE CASCADE ON UPDATE CASCADE;
