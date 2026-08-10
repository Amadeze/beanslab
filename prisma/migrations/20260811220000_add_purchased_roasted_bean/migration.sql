-- =============================================================================
-- Purchased roasted bean procurement (Commit 2: procurement GB/RB)
--
-- 1. PurchaseType.ROASTED_BEAN: pembelian biji kopi SANGRAI JADI (beli jadi),
--    lawan dari GREEN_BEAN. Product ROASTED_BEAN yang dibeli ditandai
--    materialOrigin = PURCHASED_ROASTED, coffeeSourceId tetap NULL (asal
--    tidak bisa dibuktikan otomatis; bisa ditautkan manual di master data).
-- 2. LedgerRefType.PURCHASE_RB: mutasi stok masuk Roasted Bean via Purchase,
--    agar jalur biaya masuk (moving average) tercatat terpisah dari
--    PURCHASE_GB maupun hasil sangrai internal (ROASTING_RB_IN).
--
-- Tanpa perubahan DDL tabel; hanya perluasan enum.
-- =============================================================================

-- AlterEnum
ALTER TYPE "PurchaseType" ADD VALUE 'ROASTED_BEAN';

-- AlterEnum
ALTER TYPE "LedgerRefType" ADD VALUE 'PURCHASE_RB';