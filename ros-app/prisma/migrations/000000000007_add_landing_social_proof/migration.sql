-- Migration: add_landing_social_proof
-- Adds opt-in landing page social proof fields to the tenants table.
-- All fields are non-breaking: showOnLanding defaults to false (no existing tenant
-- will appear on the landing page without explicit opt-in).

ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "showOnLanding"      BOOLEAN  NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "landingLogoUrl"     TEXT,
  ADD COLUMN IF NOT EXISTS "landingDisplayName" TEXT;
