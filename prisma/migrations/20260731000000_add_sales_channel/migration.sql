-- Generated to reconcile schema.prisma (committed) with the database.
-- schema.prisma declares `salesChannel SalesChannel @default(WALK_IN)` on the
-- Invoice model and the `SalesChannel` enum, but no migration was ever
-- generated for them, so the live `invoices` table was missing both.
-- This is a non-destructive, backfilled default; safe to apply via
-- `prisma migrate deploy` in the release pipeline (NOT run here).

CREATE TYPE "SalesChannel" AS ENUM ('WALK_IN', 'WHATSAPP', 'MARKETPLACE', 'B2B_DIRECT', 'OTHER');

ALTER TABLE "invoices"
  ADD COLUMN "salesChannel" "SalesChannel" NOT NULL DEFAULT 'WALK_IN';
