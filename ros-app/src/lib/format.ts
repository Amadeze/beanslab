/** Format angka menjadi Rupiah (IDR). Contoh: 1500000 → "Rp 1.500.000" */
export function formatRupiah(amount: number): string {
  if (!Number.isFinite(amount)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format berat kg. Di atas 1kg tampil dalam kg, di bawahnya dalam gram. */
export function formatKg(kg: number): string {
  if (kg <= 0) return "0 kg";
  if (kg >= 1) {
    return `${kg.toLocaleString("id-ID", { maximumFractionDigits: 2 })} kg`;
  }
  return `${(kg * 1000).toLocaleString("id-ID", { maximumFractionDigits: 0 })} g`;
}

/** Format satuan unit/pcs. */
export function formatUnit(unit: number): string {
  return `${unit.toLocaleString("id-ID")} pcs`;
}

/** Format tanggal ke format lokal Indonesia. */
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

/** Format tanggal dengan waktu ke format lokal Indonesia. */
export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/** Format tanggal dengan bulan panjang ke format lokal Indonesia. */
export function formatDateLong(date: Date | string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

/** Hitung HPP per kg = (harga * berat + ongkir) / berat */
export function calcHppPerKg(
  pricePerKg: number,
  weightKg: number,
  shippingCost: number
): number {
  if (weightKg <= 0) return 0;
  return (pricePerKg * weightKg + shippingCost) / weightKg;
}
