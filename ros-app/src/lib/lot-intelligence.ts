// =============================================================================
// LOT INTELLIGENCE — AI deterministik (gratis, tanpa LLM)
// Prediksi & saran untuk lot green coffee dari data intake yang dicatat
// di form barang datang. Semua fungsi murni & JSON-safe.
//
// Model loss roasting: total loss ≈ moisture% (penguapan) + organic loss
// bahan organik ~4.2% (Maillard/degradasi, kisar 3.5–5% tergantung roast
// level). Ini pendekatan industri standar (SCA water activity baseline),
// cukup akurat untuk perencanaan target output batch.
// =============================================================================

/** Loss organik non-air saat roasting (persen dari berat hijau). */
const ORGANIC_LOSS_PERCENT = 4.2;

export type MoistureYieldPrediction = {
  /** Total perkiraan loss % (moisture + organik). */
  expectedLossPercent: number;
  /** Perkiraan yield % (berat roasted / berat hijau × 100). */
  expectedYieldPercent: number;
  /** Kategori kepercayaan model terhadap input. */
  confidence: "HIGH" | "MEDIUM" | "NONE";
  /** Catatan singkat bahasa Indonesia untuk operator. */
  note: string;
};

/**
 * Prediksi yield roasting dari kadar air intake.
 * moisturePct null/undefined → prediksi generik 12% baseline (confidence NONE).
 * Rentang wajar green coffee: 9–13%. Di luar itu → MEDIUM + peringatan.
 */
export function predictRoastYieldFromMoisture(moisturePct?: number | null): MoistureYieldPrediction {
  if (moisturePct == null || !Number.isFinite(Number(moisturePct))) {
    return {
      expectedLossPercent: round1(12 + ORGANIC_LOSS_PERCENT),
      expectedYieldPercent: round1(100 - 12 - ORGANIC_LOSS_PERCENT),
      confidence: "NONE",
      note: "Kadar air belum dicatat — pakai asumsi 12%. Isi kadar air di form barang datang untuk prediksi presisi.",
    };
  }
  const m = Number(moisturePct);
  const clamped = Math.min(30, Math.max(0, m));
  const inRange = m >= 9 && m <= 13;
  return {
    expectedLossPercent: round1(clamped + ORGANIC_LOSS_PERCENT),
    expectedYieldPercent: round1(100 - clamped - ORGANIC_LOSS_PERCENT),
    confidence: inRange ? "HIGH" : "MEDIUM",
    note: inRange
      ? `Kadar air ${m}% dalam rentang specialty (9–13%).`
      : `Kadar air ${m}% di luar rentang umum (9–13%) — cek ulang alat ukur atau kondisi penyimpanan.`,
  };
}

export type DefectRisk = {
  /** Perkiraan persen kualitas cup yang hilang akibat defect (heuristik SCA). */
  qualityPenaltyPercent: number;
  severity: "LOW" | "ELEVATED" | "HIGH";
  note: string;
};

/**
 * Heuristik dampak defect count (per 300 g sampel, konvensi SCA green grading).
 * <5 = specialty grade; 5–8 mulai menurunkan konsistensi; >8 berisiko jelas.
 */
export function assessDefectRisk(defectCount?: number | null): DefectRisk {
  if (defectCount == null || !Number.isInteger(defectCount) || defectCount < 0) {
    return { qualityPenaltyPercent: 0, severity: "LOW", note: "Defect count belum dicatat." };
  }
  if (defectCount <= 4) {
    return { qualityPenaltyPercent: 0, severity: "LOW", note: `${defectCount} defect — masih dalam standar specialty (<5 per 300 g).` };
  }
  if (defectCount <= 8) {
    return {
      qualityPenaltyPercent: round1((defectCount - 4) * 0.75),
      severity: "ELEVATED",
      note: `${defectCount} defect — di atas standar specialty; sortir tambahan sebelum roast disarankan.`,
    };
  }
  return {
    qualityPenaltyPercent: Math.round((defectCount - 4) * 1.25),
    severity: "HIGH",
    note: `${defectCount} defect — tinggi. Pertimbangkan karantina QC dan klaim ke supplier.`,
  };
}

// =============================================================================
// Auto-draft PO dari saran reorder (AI gratis #2)
// =============================================================================

export type ReorderSuggestionLine = {
  subjectKind: "PRODUCT" | "SUPPLY";
  subjectId: string;
  name: string;
  /** Rata-rata pemakaian per hari (kg atau unit sesuai kind). */
  avgDailyUsage: number;
  leadTimeDays: number;
  safetyStockQuantity: number;
  currentStock: number;
  unitLabel: string;
};

export type ReorderDraftLine = {
  subjectKind: "PRODUCT" | "SUPPLY";
  subjectId: string;
  name: string;
  suggestedQuantity: number;
  unitLabel: string;
};

/**
 * Hitung kuantitas reorder: cover lead time + safety stock − stok kini,
 * dibulatkan ke atas ke kelipatan praktis. Deterministik & bisa diuji.
 */
export function buildReorderDraftLine(line: ReorderSuggestionLine): ReorderDraftLine | null {
  const leadDemand = line.avgDailyUsage * line.leadTimeDays;
  const target = Math.max(leadDemand + line.safetyStockQuantity, line.safetyStockQuantity);
  let quantity = Math.ceil(target - line.currentStock);
  // Kelipatan praktis supaya PO tidak aneh (min 1, langkah 5 untuk kg besar).
  if (quantity <= 0) return null;
  if (line.avgDailyUsage > 0 && quantity < leadDemand * 0.2) quantity = Math.ceil(leadDemand * 0.2);
  return {
    subjectKind: line.subjectKind,
    subjectId: line.subjectId,
    name: line.name,
    suggestedQuantity: quantity,
    unitLabel: line.unitLabel,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
