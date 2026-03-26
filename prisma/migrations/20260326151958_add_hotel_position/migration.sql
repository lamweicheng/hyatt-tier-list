-- DropIndex
DROP INDEX "Hotel_tier_name_idx";

-- AlterTable
ALTER TABLE "Hotel" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Hotel_tier_position_idx" ON "Hotel"("tier", "position");
