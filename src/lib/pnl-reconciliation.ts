/**
 * Banner rekonsiliasi P&L (2F.3): hanya tampil bila ada selisih nyata
 * antara pendapatan GL dan rincian operasional (> 1 sen). Tidak menampilkan
 * detail internal; cukup jumlah selisih yang perlu diperiksa.
 */

export function reconciliationWarning(diff: number): string | null {
  const rounded = Math.round(diff * 100) / 100;
  if (Math.abs(rounded) <= 0.01) return null;
  return `Perlu Pemeriksaan: rincian pendapatan berbeda ${rounded.toLocaleString("id-ID")} dari buku besar periode ini`;
}