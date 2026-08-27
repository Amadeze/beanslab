// =============================================================================
// ROASTERY INTELLIGENCE — "AI Copilot" gratis (deterministik, tanpa LLM)
// -----------------------------------------------------------------------------
// Menggabungkan tiga mesin deterministik (lot, roast, cupping) menjadi satu
// daftar insight + rekomendasi aksi untuk dasbor manajerial. Semua logika
// murni & JSON-safe sehingga bisa diuji dan dijalankan di client maupun server.
//
// Narasi bahasa alami bersifat OPSIONAL dan default OFF: bila
// ROASTD_LLM_BASE_URL diisi (mis. Ollama lokal), ringkasan bisa dibuat oleh
// LLM self-host. Tanpa env tersebut, Copilot sepenuhnya $0 dan deterministik.
// =============================================================================

import {
  assessDefectRisk,
  predictRoastYieldFromMoisture,
  buildReorderDraftLine,
  type ReorderSuggestionLine,
} from "./lot-intelligence";

export type CopilotSeverity = "info" | "attention" | "critical";
export type CopilotDomain = "lot" | "batch" | "cupping" | "inventory";

export interface CopilotAction {
  label: string;
  href: string;
}

export interface CopilotInsight {
  id: string;
  domain: CopilotDomain;
  severity: CopilotSeverity;
  title: string;
  detail: string;
  action?: CopilotAction;
  /** Metrik singkat untuk badge (contoh: "SCA 78"). */
  metric?: string;
}

export interface CopilotLotFact {
  id: string;
  code: string;
  qcStatus: "PENDING" | "RELEASED" | "HOLD" | null;
  defectCount: number | null;
  moisturePct: number | null;
}

export interface CopilotCuppingFact {
  id: string;
  code: string;
  totalScore: number | null;
  defectCount: number | null;
  lotId: string | null;
}

export interface CopilotReorderFact {
  subjectKind: "PRODUCT" | "SUPPLY";
  subjectId: string;
  name: string;
  suggestedQuantity: number;
  unitLabel: string;
}

export interface CopilotFacts {
  lots: CopilotLotFact[];
  cupping: CopilotCuppingFact[];
  reorder: CopilotReorderFact[];
}

/** Ambang SCA "specialty" untuk sinyal perhatian. */
export const SPECIALTY_THRESHOLD = 80;

/**
 * Bangun daftar insight dari fakta mentah. Murni & deterministik.
 * Setiap domain dibatasi agar dasbor tidak membanjiri (maks 5 per domain).
 */
export function buildRoasteryInsights(facts: CopilotFacts): CopilotInsight[] {
  const insights: CopilotInsight[] = [];

  // ── INVENTORY: saran reorder (PO otomatis) ────────────────────────────────
  for (const line of facts.reorder.slice(0, 5)) {
    insights.push({
      id: `reorder:${line.subjectId}`,
      domain: "inventory",
      severity: "attention",
      title: `Saran restock ${line.name}`,
      detail: `Stok mendekati batas aman. Ajukan PO sekitar ${line.suggestedQuantity} ${line.unitLabel}.`,
      action: { label: "Buat PO", href: "/inventory" },
      metric: `${line.suggestedQuantity} ${line.unitLabel}`,
    });
  }

  // ── LOT: QC hold, defect risk, prediksi yield rendah ──────────────────────
  const lots = facts.lots.slice(0, 50);
  for (const lot of lots) {
    if (lot.qcStatus === "HOLD") {
      insights.push({
        id: `lot:hold:${lot.id}`,
        domain: "lot",
        severity: "critical",
        title: `Lot ${lot.code} ditahan QC`,
        detail: "Lot tidak boleh dipakai roast sampai dilepas. Cek panel QC lot.",
        action: { label: "Lepas / tinjau", href: `/inventory/lots/${lot.id}` },
      });
    }
    const defect = assessDefectRisk(lot.defectCount);
    if (defect.severity === "HIGH") {
      insights.push({
        id: `lot:defect:${lot.id}`,
        domain: "lot",
        severity: "attention",
        title: `Defect tinggi pada ${lot.code}`,
        detail: defect.note,
        action: { label: "Panen sortir", href: `/inventory/lots/${lot.id}` },
      });
    }
    const yieldPred = predictRoastYieldFromMoisture(lot.moisturePct);
    if (yieldPred.expectedYieldPercent < 82 && lot.moisturePct != null) {
      insights.push({
        id: `lot:yield:${lot.id}`,
        domain: "lot",
        severity: "attention",
        title: `Yield roast rendah diprediksi (${lot.code})`,
        detail: `${yieldPred.note} Perkiraan yield ${yieldPred.expectedYieldPercent}%.`,
        action: { label: "Lihat lot", href: `/inventory/lots/${lot.id}` },
        metric: `${yieldPred.expectedYieldPercent}%`,
      });
    }
  }

  // ── CUPPING: di bawah specialty, defect aktual, belum ditautkan ke lot ────
  const cups = facts.cupping.slice(0, 50);
  for (const cup of cups) {
    if (cup.totalScore != null && cup.totalScore < SPECIALTY_THRESHOLD) {
      insights.push({
        id: `cupping:below:${cup.id}`,
        domain: "cupping",
        severity: "attention",
        title: `Cupping ${cup.code} di bawah specialty`,
        detail: `Skor SCA ${cup.totalScore} (<${SPECIALTY_THRESHOLD}). Tinjau profil roast atau green lot terkait.`,
        action: { label: "Lihat cupping", href: "/cupping" },
        metric: `SCA ${cup.totalScore}`,
      });
    }
    if (cup.defectCount != null && cup.defectCount > 0) {
      insights.push({
        id: `cupping:defect:${cup.id}`,
        domain: "cupping",
        severity: "info",
        title: `Cupping ${cup.code} mencatat ${cup.defectCount} defect`,
        detail: "Ada taint/fault aktual — bisa jadi sinyal lot atau proses perlu perbaikan.",
      });
    }
    if (!cup.lotId) {
      insights.push({
        id: `cupping:unlinked:${cup.id}`,
        domain: "cupping",
        severity: "info",
        title: `Cupping ${cup.code} belum ditautkan ke lot`,
        detail: "Tautkan ke lot green bean agar rantai lot → roast → cup traceable.",
        action: { label: "Tautkan lot", href: "/cupping" },
      });
    }
  }

  // Urutkan: critical dulu, lalu attention, lalu info.
  const order: Record<CopilotSeverity, number> = { critical: 0, attention: 1, info: 2 };
  return insights.sort((a, b) => order[a.severity] - order[b.severity]);
}

/** Ringkasan naratif deterministik (bahasa Indonesia). Dipakai sebagai fallback
 *  bila narasi LLM tidak diaktifkan/tersedia. */
export function summarizeInsights(insights: CopilotInsight[]): string {
  if (insights.length === 0) {
    return "Tidak ada sinyal operasional yang butuh tindakan sekarang. Kualitas & stok dalam batas normal.";
  }
  const counts = insights.reduce<Record<CopilotSeverity, number>>(
    (acc, i) => {
      acc[i.severity] += 1;
      return acc;
    },
    { critical: 0, attention: 0, info: 0 },
  );
  const head = `Terdapat ${insights.length} sinyal: ${counts.critical} kritis, ${counts.attention} perhatian, ${counts.info} info.`;
  const bullets = insights
    .slice(0, 6)
    .map((i) => `• [${i.domain}] ${i.title}. ${i.detail}`)
    .join("\n");
  const more = insights.length > 6 ? `\n…dan ${insights.length - 6} sinyal lainnya.` : "";
  return `${head}\n${bullets}${more}`;
}

/** Bantu server action menyusun input reorder dari produk green bean. */
export function draftReorderFromProduct(
  product: { id: string; name: string; stockKg: number; safetyStockQuantity: number },
): CopilotReorderFact | null {
  if (product.safetyStockQuantity <= 0) return null;
  const currentStock = product.stockKg ?? 0;
  if (currentStock >= product.safetyStockQuantity) return null;
  const line: ReorderSuggestionLine = {
    subjectKind: "PRODUCT",
    subjectId: product.id,
    name: product.name,
    avgDailyUsage: 0,
    leadTimeDays: 0,
    safetyStockQuantity: product.safetyStockQuantity,
    currentStock,
    unitLabel: "kg",
  };
  const draft = buildReorderDraftLine(line);
  if (!draft) return null;
  return {
    subjectKind: draft.subjectKind,
    subjectId: draft.subjectId,
    name: draft.name,
    suggestedQuantity: draft.suggestedQuantity,
    unitLabel: draft.unitLabel,
  };
}
