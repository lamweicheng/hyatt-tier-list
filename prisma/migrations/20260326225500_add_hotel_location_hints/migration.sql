-- AlterTable
ALTER TABLE "Hotel"
ADD COLUMN IF NOT EXISTS "locationCity" TEXT;

ALTER TABLE "Hotel"
ADD COLUMN IF NOT EXISTS "locationCountry" TEXT;
