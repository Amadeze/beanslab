// =============================================================================
// CUPPING INTELLIGENCE ΓÇö AI deterministik (gratis, tanpa LLM)
// Komposit SCA 0ΓÇô100 dari 11 kategori internal (Fragrance & Aroma digabung
// jadi satu item 10-poin sesuai protokol SCA) + penalti defect 2 poin/defect
// (maks 10). Grade otomatis + band bahasa Indonesia.
// =============================================================================

import type { CuppingCategory } from "@prisma/client";

/** Rata-rata skor per kategori; kategori hilang dianggap 0 (protokol wajib lengkap, dijaga di action). */
export function computeScaTotal(
  scores: Partial<Record<CuppingCategory | string, number>>,
  defectCount?: number | null,
): number {
  // Fragrance & Aroma digabung jadi satu item 10-poin. Bila hanya satu yang diisi,
  // gunakan nilai tersebut (bukan (nilai+0)/2 yang memotong skor menjadi setengah).
  const avg = (a?: number | null, b?: number | null) => {
    const vals = [a, b].filter((v): v is number => v != null);
    if (vals.length === 0) return 0;
    return vals.reduce((acc, v) => acc + v, 0) / vals.length;
  };

  const items = [
    avg(scores.FRAGRANCE, scores.AROMA), // SCA: Fragrance/Aroma = satu item
    scores.FLAVOR ?? 0,
    scores.AFTERTASTE ?? 0,
    scores.ACIDITY ?? 0,
    scores.BODY ?? 0,
    scores.BALANCE ?? 0,
    scores.UNIFORMITY ?? 0,
    scores.CLEAN_CUP ?? 0,
    scores.SWEETNESS ?? 0,
    scores.OVERALL ?? 0,
  ];

  const sum = items.reduce((acc, value) => acc + Math.min(10, Math.max(0, value)), 0);
  const penalty = Math.min(10, Math.max(0, defectCount ?? 0) * 2);
  return roundQuarter(Math.max(0, sum - penalty));
}

export type ScaGrade = "OUTSTANDING" | "EXCELLENT" | "SPECIALTY" | "BELOW_SPECIALTY";

/** Ambang industri: ΓëÑ80 specialty; 80-an bagus; ΓëÑ87 kelas kompetisi. */
export function scaGrade(total: number): ScaGrade {
  if (total >= 87) return "OUTSTANDING";
  if (total >= 84) return "EXCELLENT";
  if (total >= 80) return "SPECIALTY";
  return "BELOW_SPECIALTY";
}

export const SCA_GRADE_LABEL: Record<ScaGrade, { label: string; className: string }> = {
  OUTSTANDING: { label: "Istimewa (ΓëÑ87)", className: "bg-purple-50 text-purple-700 border-purple-200" },
  EXCELLENT: { label: "Sangat Baik (84ΓÇô86.99)", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  SPECIALTY: { label: "Specialty (80ΓÇô83.99)", className: "bg-blue-50 text-blue-700 border-blue-200" },
  BELOW_SPECIALTY: { label: "Di bawah specialty (<80)", className: "bg-zinc-50 text-zinc-600 border-zinc-200" },
};

function roundQuarter(value: number): number {
  return Math.round(value * 4) / 4;
}

