-- Migration: email_verification
-- Verifikasi email untuk pendaftaran workspace self-service.
--
-- 1. users.emailVerifiedAt: null = belum terverifikasi.
-- 2. Backfill: semua user yang ada SEBELUM migration ini dianggap
--    terverifikasi (dibuat lewat jalur terpercaya / sudah beroperasi).
--    Hanya pendaftar baru yang mulai dari null dan wajib verifikasi.
-- 3. Tabel email_verification_tokens menyimpan HASH token (bukan token),
--    satu token aktif per user, kedaluwarsa, dan single-use.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);

UPDATE "users"
SET "emailVerifiedAt" = "createdAt"
WHERE "emailVerifiedAt" IS NULL;

CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
  "id"        TEXT       NOT NULL,
  "userId"    TEXT       NOT NULL,
  "tokenHash" TEXT       NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_verification_tokens_userId_key"
  ON "email_verification_tokens" ("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "email_verification_tokens_tokenHash_key"
  ON "email_verification_tokens" ("tokenHash");

CREATE INDEX IF NOT EXISTS "email_verification_tokens_expiresAt_idx"
  ON "email_verification_tokens" ("expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_verification_tokens_userId_fkey'
  ) THEN
    ALTER TABLE "email_verification_tokens"
      ADD CONSTRAINT "email_verification_tokens_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;
