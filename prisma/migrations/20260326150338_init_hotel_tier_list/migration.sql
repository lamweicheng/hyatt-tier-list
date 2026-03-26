-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('S', 'A', 'B', 'C', 'D');

-- CreateTable
CREATE TABLE "Hotel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "tier" "Tier" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hotel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Hotel_tier_name_idx" ON "Hotel"("tier", "name");

-- CreateIndex
CREATE INDEX "Hotel_brand_idx" ON "Hotel"("brand");
