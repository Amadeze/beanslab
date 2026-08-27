/**
 * Volume penjualan kopi (dashboard) — 2G.
 *
 * Berat terjual dihitung dari ledger (SALE_FG_OUT − RETURN_FG_IN) dikali
 * berat per unit (outputGrams dari resep TERBARU produk). Produk jadi tanpa
 * resep TIDAK dihilangkan dari hitungan: unitnya tetap dihitung sebagai
 * "tanpa berat" agar kuantitas terjual tidak hilang secara diam-diam.
 */

export type SoldLedgerEntry = {
  entryType: "IN" | "OUT";
  quantityUnit: number;
  /** outputGrams per unit; 0/null bila produk tidak punya resep. */
  outputGrams: number | null;
};

export type NetSoldKg = {
  kg: number;
  /** Unit terjual dari produk TANPA resep (tidak bisa dikonversi ke kg). */
  unitsWithoutWeight: number;
};

export function netSoldKg(entries: SoldLedgerEntry[]): NetSoldKg {
  let kg = 0;
  let unitsWithoutWeight = 0;
  for (const entry of entries) {
    const grams = entry.outputGrams;
    const qty = Math.max(0, Number(entry.quantityUnit) || 0);
    if (grams == null || grams <= 0) {
      unitsWithoutWeight += qty;
      continue;
    }
    const sign = entry.entryType === "IN" ? -1 : 1;
    kg += (qty * grams) / 1000 * sign;
  }
  return { kg, unitsWithoutWeight };
}
