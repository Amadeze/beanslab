-- Audit queries untuk migration 012_stockreservation_grindsize_payment_proof_unique
-- Jalankan HANYA di production backup (read-only), JANGAN di live prod.
-- Semua query adalah SELECT saja, tidak ada DDL/DML.
-- Jika A return >0 baris → cleanup manual dulu sebelum deploy migration 012 (strategi FAIL).

-- ============================================================================
-- A. PaymentSubmission duplicates (akan gagalkan UNIQUE baru)
--    @@unique([tenantId, proofSha256]) — duplikat proofSha256 per tenant harus 0
-- ============================================================================
SELECT "tenantId", "proofSha256", COUNT(*) AS dup_count, array_agg("id") AS ids
FROM "payment_submissions"
WHERE "proofSha256" IS NOT NULL
GROUP BY "tenantId", "proofSha256"
HAVING COUNT(*) > 1
ORDER BY dup_count DESC;

-- Detail baris duplikat (untuk investigasi manual)
-- SELECT "id", "tenantId", "invoiceId", "proofSha256", "status", "createdAt"
-- FROM "payment_submissions"
-- WHERE ("tenantId", "proofSha256") IN (
--   SELECT "tenantId", "proofSha256" FROM "payment_submissions"
--   WHERE "proofSha256" IS NOT NULL GROUP BY "tenantId", "proofSha256" HAVING COUNT(*) > 1
-- )
-- ORDER BY "tenantId", "proofSha256", "createdAt";

-- ============================================================================
-- B. StockReservation old unique sanity
--    Old: @@unique([invoiceId, productId]) — harus 0 duplikat sebelum migrasi
--    New: @@unique([invoiceId, productId, grindSize]) — akan allow beda grindSize
-- ============================================================================
SELECT "invoiceId", "productId", COUNT(*) AS dup_count, array_agg("id") AS ids
FROM "stock_reservations"
GROUP BY "invoiceId", "productId"
HAVING COUNT(*) > 1
ORDER BY dup_count DESC;

-- Setelah migrasi (grindSize terisi), cek duplikat new key juga 0
-- SELECT "invoiceId", "productId", "grindSize", COUNT(*) AS dup_count, array_agg("id") AS ids
-- FROM "stock_reservations"
-- GROUP BY "invoiceId", "productId", "grindSize"
-- HAVING COUNT(*) > 1
-- ORDER BY dup_count DESC;

-- ============================================================================
-- C. Null stats
-- ============================================================================
SELECT COUNT(*) AS total, COUNT("proofSha256") AS non_null_proof
FROM "payment_submissions";

SELECT COUNT(*) AS total
FROM "stock_reservations";

-- Extended null stats (opsional, untuk laporan)
SELECT COUNT(*) AS total,
       COUNT("grindSize") AS non_null_grind,
       COUNT("customGrindLabel") AS non_null_label
FROM "stock_reservations";

SELECT "status", COUNT(*) FROM "payment_submissions" GROUP BY "status" ORDER BY COUNT(*) DESC;
SELECT "status", COUNT(*) FROM "stock_reservations" GROUP BY "status" ORDER BY COUNT(*) DESC;

-- ============================================================================
-- D. Verifikasi index/constraint setelah migrasi (opsional)
-- ============================================================================
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN ('payment_submissions','stock_reservations') ORDER BY tablename, indexname;
-- SELECT conname, contype FROM pg_constraint WHERE conrelid IN ('stock_reservations'::regclass, 'payment_submissions'::regclass);
