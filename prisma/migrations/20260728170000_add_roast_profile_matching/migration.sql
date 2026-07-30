CREATE TYPE "RoastMatchStatus" AS ENUM ('ON_TRACK', 'WATCH', 'DIVERGED', 'INVALID');

ALTER TABLE "parent_roasting_batches"
ADD COLUMN "referenceRoastId" TEXT;

ALTER TABLE "child_roasting_batches"
ADD COLUMN "matchScore" DOUBLE PRECISION,
ADD COLUMN "matchStatus" "RoastMatchStatus",
ADD COLUMN "matchDetails" JSONB,
ADD COLUMN "matchedAt" TIMESTAMP(3);

CREATE INDEX "parent_roasting_batches_referenceRoastId_idx"
ON "parent_roasting_batches"("referenceRoastId");

ALTER TABLE "parent_roasting_batches"
ADD CONSTRAINT "parent_roasting_batches_referenceRoastId_fkey"
FOREIGN KEY ("referenceRoastId") REFERENCES "roasts"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
