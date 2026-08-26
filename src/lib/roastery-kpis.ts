/**
 * KPI industri roastery (fungsi murni — pemanggil menyediakan data mentah).
 * Definisi mengikuti praktik umum roastery management (Cropster/RoastWerk dkk):
 *  - FEFO risk      : porsi stok yang kedaluwarsasanya ≤ horizon (default 30 hr).
 *  - Green turnover : berapa kali stok green bean "berputar" per tahun,
 *                     dihitung dari konsumsi roasting (annualized dari window).
 *  - Days on hand   : hari persediaan roasted bean tersisa pada ritme jual
 *                     saat ini (kg ekivalen, resep disediakan pemanggil).
 */

export type FefoLotInput = {
  kg: number;
  /** ISO date atau null (tanpa tanggal kedaluwarsa = di luar hitungan risiko). */
  expiryDate: string | null;
};

export type FefoRiskResult = {
  totalKg: number;
  atRiskKg: number;
  /** 0–100; null bila tidak ada stok bernilai. */
  riskPct: number | null;
  /** Lot terdekat (hari); negatif = sudah lewat. */
  minDaysToExpiry: number | null;
};

export function computeFefoRisk(
  lots: FefoLotInput[],
  horizonDays = 30,
  now: Date = new Date(),
): FefoRiskResult {
  let totalKg = 0;
  let atRiskKg = 0;
  let minDays: number | null = null;

  for (const lot of lots) {
    const kg = Math.max(0, Number(lot.kg ?? 0));
    if (kg <= 0) continue;
    totalKg += kg;

    if (!lot.expiryDate) continue;
    const days = Math.ceil((new Date(lot.expiryDate).getTime() - now.getTime()) / 86_400_000);
    if (minDays === null || days < minDays) minDays = days;
    if (days <= horizonDays) atRiskKg += kg;
  }

  return {
    totalKg: round2(totalKg),
    atRiskKg: round2(atRiskKg),
    riskPct: totalKg > 0 ? round2((atRiskKg / totalKg) * 100) : null,
    minDaysToExpiry: minDays,
  };
}

export type GreenTurnoverInput = {
  /** Total GB keluar lewat roasting dalam window (kg). */
  consumedKgInWindow: number;
  /** Panjang window dalam hari (mis. 90). */
  windowDays: number;
  /** Stok green bean saat ini (kg). */
  currentStockKg: number;
};

export type GreenTurnoverResult = {
  /** Kali putaran per tahun (annualized); null bila stok nol. */
  turnoverAnnualized: number | null;
  /** Hari sampai stok habis pada ritme konsumsi window. */
  daysOfSupply: number | null;
};

export function computeGreenTurnover(input: GreenTurnoverInput): GreenTurnoverResult {
  const consumedPerDay =
    input.windowDays > 0 ? Math.max(0, input.consumedKgInWindow) / input.windowDays : 0;

  const turnoverAnnualized =
    input.currentStockKg > 0 && consumedPerDay > 0
      ? round2((consumedPerDay * 365) / input.currentStockKg)
      : null;

  const daysOfSupply =
    consumedPerDay > 0 ? round2(Math.max(0, input.currentStockKg) / consumedPerDay) : null;

  return { turnoverAnnualized, daysOfSupply };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export type DaysOnHandInput = {
  /** Stok roasted bean saat ini (kg). */
  rbStockKg: number;
  /** Total FG terjual (kg ekivalen) dalam window. */
  fgSoldKgInWindow: number;
  /** Panjang window (hari), default 30. */
  windowDays?: number;
};

/** Hari persediaan roasted bean tersisa; target sehat industri 7–14 hari. */
export function computeDaysRoastedOnHand(input: DaysOnHandInput): number | null {
  const days = input.windowDays ?? 30;
  if (days <= 0) return null;
  const dailySold = Math.max(0, input.fgSoldKgInWindow) / days;
  if (dailySold <= 0) return null;
  return round2(Math.max(0, input.rbStockKg) / dailySold);
}

/** Penilaian banding target industri: 7–14 hari = sehat. */
export function assessDaysOnHand(days: number | null): "low" | "healthy" | "high" | "unknown" {
  if (days === null || !Number.isFinite(days)) return "unknown";
  if (days < 7) return "low";
  if (days <= 14) return "healthy";
  return "high";
}
