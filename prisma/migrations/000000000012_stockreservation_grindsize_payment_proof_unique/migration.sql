-- Migration: stockreservation_grindsize_payment_proof_unique (012)
-- Opsi B curated — memisahkan domain fix dari UI churn.
-- Sumber: diff schema mobile-ui-refactor.bak @84169e0 vs main @761bce6
--   StockReservation: +grindSize GrindSize?, +customGrindLabel, @@unique -> [invoiceId, productId, grindSize]
--   PaymentSubmission: @@index([tenantId, proofSha256, submittedAt]) -> @@unique([tenantId, proofSha256])
--
-- Strategi: FAIL jika ada duplikat proofSha256 (jangan partial index).
-- Audit dulu dengan scripts/audit-migration-012.sql di production backup (read-only).
-- Jika audit A return >0 baris, cleanup manual sebelum deploy migrasi ini.
-- Kolom baru idempoten (IF NOT EXISTS), unique creation akan error jika duplikat — itu yang diinginkan.

-- 1. StockReservation: tambah kolom grind support
-- GrindSize enum sudah ada sejak baseline (WHOLE_BEAN, COARSE, MEDIUM_COARSE, MEDIUM, MEDIUM_FINE, FINE, ESPRESSO, CUSTOM)
ALTER TABLE "stock_reservations" ADD COLUMN IF NOT EXISTS "grindSize" "GrindSize";
ALTER TABLE "stock_reservations" ADD COLUMN IF NOT EXISTS "customGrindLabel" TEXT;

-- 2. StockReservation: ganti unique [invoiceId, productId] -> [invoiceId, productId, grindSize]
-- Baseline membuat: CREATE UNIQUE INDEX "stock_reservations_invoiceId_productId_key" ON "stock_reservations"("invoiceId", "productId");
DROP INDEX IF EXISTS "stock_reservations_invoiceId_productId_key";
-- Prisma akan generate nama yang sama untuk new unique:
-- TANPA IF NOT EXISTS — harus FAIL jika ada duplikat (strategi KRITIKAL)
CREATE UNIQUE INDEX "stock_reservations_invoiceId_productId_grindSize_key"
  ON "stock_reservations"("invoiceId", "productId", "grindSize");
-- Catatan PG: UNIQUE dengan kolom nullable memperbolehkan multi NULL (NULL != NULL).
-- Untuk produk non-kopi (grindSize NULL) tetap 1 baris per (invoice,product) karena app guard,
-- tapi DB akan izinkan duplikat NULL jika ada bug app — audit B harus 0 sebelum migrasi.

-- 3. PaymentSubmission: ganti index -> unique [tenantId, proofSha256]
-- Baseline: CREATE INDEX "payment_submissions_tenantId_proofSha256_submittedAt_idx" ON "payment_submissions"("tenantId", "proofSha256", "submittedAt");
DROP INDEX IF EXISTS "payment_submissions_tenantId_proofSha256_submittedAt_idx";
-- Prisma name untuk @@unique([tenantId, proofSha256]): "payment_submissions_tenantId_proofSha256_key"
-- TANPA IF NOT EXISTS — harus FAIL jika ada duplikat proofSha256 (strategi KRITIKAL)
CREATE UNIQUE INDEX "payment_submissions_tenantId_proofSha256_key"
  ON "payment_submissions"("tenantId", "proofSha256");
-- proofSha256 nullable: PG izinkan banyak NULL (sesuai Prisma String? unique behavior).

-- 4. Index yang tidak berubah dijamin tetap ada (idempoten)
CREATE INDEX IF NOT EXISTS "payment_submissions_status_expiresAt_idx"
  ON "payment_submissions"("status", "expiresAt");
CREATE INDEX IF NOT EXISTS "stock_reservations_tenantId_status_expiresAt_idx"
  ON "stock_reservations"("tenantId", "status", "expiresAt");
CREATE INDEX IF NOT EXISTS "stock_reservations_tenantId_productId_status_idx"
  ON "stock_reservations"("tenantId", "productId", "status");
