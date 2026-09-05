import { computeScaTotal } from "./cupping-intelligence";
import type { CuppingCategory } from "@prisma/client";

export interface CuppingScoreInput {
  FRAGRANCE?: number | null;
  AROMA?: number | null;
  FLAVOR?: number | null;
  AFTERTASTE?: number | null;
  ACIDITY?: number | null;
  BODY?: number | null;
  BALANCE?: number | null;
  UNIFORMITY?: number | null;
  CLEAN_CUP?: number | null;
  SWEETNESS?: number | null;
  OVERALL?: number | null;
  [key: string]: number | null | undefined;
}

export interface ConsensusResult {
  sessionCount: number;
  meanTotal: number | null;
  minTotal: number | null;
  maxTotal: number | null;
  categoryMeans: Record<CuppingCategory, number>;
  agreementPercent: number | null;
}

export interface SessionWithScores {
  scores: CuppingScoreInput;
  precomputedTotal?: number | null;
  defectCount?: number | null;
}

const CATEGORY_VALUES: CuppingCategory[] = [
  "FRAGRANCE",
  "AROMA",
  "FLAVOR",
  "AFTERTASTE",
  "ACIDITY",
  "BODY",
  "BALANCE",
  "UNIFORMITY",
  "CLEAN_CUP",
  "SWEETNESS",
  "OVERALL",
];

function emptyCategoryMap(): Record<CuppingCategory, number> {
  const map = {} as Record<CuppingCategory, number>;
  for (const cat of CATEGORY_VALUES) map[cat] = 0;
  return map;
}

function isSessionWithScores(
  value: CuppingScoreInput | SessionWithScores,
): value is SessionWithScores {
  return (
    typeof value === "object" &&
    value !== null &&
    "scores" in value &&
    typeof (value as SessionWithScores).scores === "object"
  );
}

export function computeConsensusFromScores(
  scores: CuppingScoreInput[] | SessionWithScores[],
  fallbackDefectCount = 0,
): ConsensusResult {
  if (scores.length === 0) {
    return {
      sessionCount: 0,
      meanTotal: null,
      minTotal: null,
      maxTotal: null,
      categoryMeans: emptyCategoryMap(),
      agreementPercent: null,
    };
  }
  const normalized: CuppingScoreInput[] = scores.map((entry) => {
    return isSessionWithScores(entry) ? entry.scores : entry;
  });
  const totals = scores.map((entry) => {
    if (isSessionWithScores(entry)) {
      if (typeof entry.precomputedTotal === "number") return entry.precomputedTotal;
      return computeScaTotal(coalesceNulls(entry.scores), entry.defectCount ?? fallbackDefectCount);
    }
    return computeScaTotal(coalesceNulls(entry), fallbackDefectCount);
  });
  const total = totals.reduce((acc, value) => acc + value, 0);
  const meanTotal = total / totals.length;
  const minTotal = Math.min(...totals);
  const maxTotal = Math.max(...totals);

  const categorySums = emptyCategoryMap();
  for (const scoreInput of normalized) {
    for (const cat of CATEGORY_VALUES) {
      const value = scoreInput[cat];
      if (typeof value === "number") {
        categorySums[cat] += value;
      }
    }
  }
  const categoryMeans = emptyCategoryMap();
  for (const cat of CATEGORY_VALUES) {
    categoryMeans[cat] = categorySums[cat] / scores.length;
  }
  const agreementPercent =
    meanTotal > 0 ? Math.max(0, Math.round((1 - (maxTotal - minTotal) / meanTotal) * 100)) : null;
  return {
    sessionCount: scores.length,
    meanTotal,
    minTotal,
    maxTotal,
    categoryMeans,
    agreementPercent,
  };
}

function coalesceNulls(score: CuppingScoreInput): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of Object.keys(score)) {
    const value = score[key];
    if (typeof value === "number") out[key] = value;
  }
  return out;
}