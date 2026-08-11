-- Make the Prisma non-null contract for offering grind choices explicit.
UPDATE "coffee_offerings"
SET "grindOptions" = ARRAY['WHOLE_BEAN']::"GrindSize"[]
WHERE "grindOptions" IS NULL;

ALTER TABLE "coffee_offerings"
ALTER COLUMN "grindOptions" SET DEFAULT ARRAY['WHOLE_BEAN']::"GrindSize"[],
ALTER COLUMN "grindOptions" SET NOT NULL;

-- Preserve the exact sellable variant identity in the immutable order snapshot.
ALTER TABLE "invoice_items"
ADD COLUMN "offeringVariantId" TEXT;

CREATE INDEX "invoice_items_offeringVariantId_idx"
ON "invoice_items"("offeringVariantId");
