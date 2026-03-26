DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_type t
		JOIN pg_namespace n ON n.oid = t.typnamespace
		WHERE t.typname = 'StayType' AND n.nspname = 'public'
	) THEN
		CREATE TYPE "StayType" AS ENUM ('EXPLORED', 'FUTURE');
	END IF;
END $$;

ALTER TABLE "Hotel"
ADD COLUMN IF NOT EXISTS "stayType" "StayType",
ADD COLUMN IF NOT EXISTS "roomEntries" JSONB;

ALTER TABLE "Hotel"
ALTER COLUMN "stayType" SET DEFAULT 'EXPLORED';

UPDATE "Hotel"
SET "stayType" = 'EXPLORED'
WHERE "stayType" IS NULL;

ALTER TABLE "Hotel"
ALTER COLUMN "stayType" SET NOT NULL,
ALTER COLUMN "tier" DROP NOT NULL;

DROP INDEX IF EXISTS "Hotel_tier_position_idx";

CREATE INDEX IF NOT EXISTS "Hotel_stayType_tier_position_idx" ON "Hotel"("stayType", "tier", "position");