import type { InventorySupplyCategory } from "@prisma/client";

// =============================================================================
// Akun persediaan/issue supply — SATU helper pusat (jangan hardcode di actions).
//
// Kebijakan Phase 1:
//   • Semua supply stock-tracked masuk aset persediaan saat diterima.
//   • PACKAGING/INGREDIENT dengan includeInProductHpp dipindahkan ke HPP saat
//     produksi (Commit 4) via getSupplyProductionHppAccount.
//   • CONSUMABLE/SPARE_PART menjadi beban ketika adjustment/issue OUT.
//   • MERCHANDISE tetap inventory asset; EQUIPMENT diperlakukan sebagai
//     inventory belum dikapitalisasi (fixed assets/depreciation di luar scope).
//
// GAP yang dilaporkan (tidak membuat chart of accounts baru):
//   Belum ada akun aset persediaan terpisah per kategori (bahan baku,
//   consumable, merchandise, dll). Fase 1 memakai akun "1-1230 Persediaan
//   Kemasan" yang sudah ada sebagai aset persediaan non-kopi, dan "5-1040
//   Selisih Penyesuaian Persediaan" untuk beban penyesuaian. Jika akun
//   terpisah dibutuhkan, buat migrasi akun tersendiri (di luar scope Phase 1).
// =============================================================================

export const SUPPLY_INVENTORY_ACCOUNT = "1-1230"; // Persediaan Kemasan → aset persediaan non-kopi
export const SUPPLY_ISSUE_EXPENSE_ACCOUNT = "5-1040"; // Selisih Penyesuaian Persediaan
export const SUPPLY_PRODUCTION_HPP_ACCOUNT = "5-1030"; // HPP - Kemasan

/** Akun aset persediaan saat supply diterima (purchase / adjustment IN). */
export function getSupplyInventoryAccount(
  _category: InventorySupplyCategory,
): string {
  return SUPPLY_INVENTORY_ACCOUNT;
}

/** Akun beban saat supply dikeluarkan (adjustment/issue OUT, opname). */
export function getSupplyIssueExpenseAccount(
  _category: InventorySupplyCategory,
  _includeInProductHpp: boolean,
): string {
  return SUPPLY_ISSUE_EXPENSE_ACCOUNT;
}

/** Akun HPP saat supply dikonsumsi dalam produksi (dipakai Commit 4). */
export function getSupplyProductionHppAccount(
  _category: InventorySupplyCategory,
): string {
  return SUPPLY_PRODUCTION_HPP_ACCOUNT;
}