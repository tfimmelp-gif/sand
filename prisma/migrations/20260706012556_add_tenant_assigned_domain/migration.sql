-- AlterTable
ALTER TABLE "User" ADD COLUMN     "assignedDomainId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_assignedDomainId_fkey" FOREIGN KEY ("assignedDomainId") REFERENCES "Domain"("id") ON DELETE SET NULL ON UPDATE CASCADE;
