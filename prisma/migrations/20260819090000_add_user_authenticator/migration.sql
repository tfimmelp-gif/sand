ALTER TABLE "User" ADD COLUMN "authenticatorSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "authenticatorEnabled" BOOLEAN NOT NULL DEFAULT false;
