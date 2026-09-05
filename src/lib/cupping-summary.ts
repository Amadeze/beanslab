import { prisma } from "@/lib/prisma";
import { scaGrade, SCA_GRADE_LABEL, type ScaGrade } from "@/lib/cupping-intelligence";
import {
  computeConsensusFromScores,
  type ConsensusResult,
  type SessionWithScores,
} from "./cuppingSummaryMath";
import type { CuppingCategory } from "@prisma/client";

export interface CupperSessionSummary {
  sessionId: string;
  code: string;
  date: Date;
  evaluatorName: string | null;
  totalScore: number;
  grade: ScaGrade;
  gradeLabel: string;
  categoryAverages: Record<CuppingCategory, number>;
}

export type CuppingConsensus = ConsensusResult;

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

function gradeLabel(grade: ScaGrade): string {
  return SCA_GRADE_LABEL[grade].label;
}

export async function loadSessionSummary(
  sessionId: string,
  tenantId: string,
): Promise<CupperSessionSummary | null> {
  const session = await prisma.cuppingSession.findFirst({
    where: { id: sessionId, tenantId },
    include: { scores: true },
  });
  if (!session) return null;

  const categoryAverages = emptyCategoryMap();
  for (const cat of CATEGORY_VALUES) {
    const score = session.scores.find((entry) => entry.category === cat);
    categoryAverages[cat] = score ? Number(score.score) : 0;
  }
  const total = session.totalScore ?? 0;
  const grade = scaGrade(total);
  return {
    sessionId: session.id,
    code: session.code,
    date: session.date,
    evaluatorName: session.evaluatorName,
    totalScore: total,
    grade,
    gradeLabel: gradeLabel(grade),
    categoryAverages,
  };
}

export async function loadConsensusForBatch(
  batchId: string,
  tenantId: string,
): Promise<CuppingConsensus> {
  const sessions = await prisma.cuppingSession.findMany({
    where: { batchId, tenantId },
    include: { scores: true },
  });
  const scoreInputs = sessions.map((session) => {
    const scores: Record<string, number> = {};
    for (const cat of CATEGORY_VALUES) {
      const score = session.scores.find((entry) => entry.category === cat);
      scores[cat] = score ? Number(score.score) : 0;
    }
    return {
      scores: scores as Parameters<typeof computeConsensusFromScores>[0][number] extends infer T
        ? T extends SessionWithScores
          ? T["scores"]
          : never
        : never,
      precomputedTotal: session.totalScore,
      defectCount: session.defectCount,
    } satisfies SessionWithScores;
  });
  return computeConsensusFromScores(scoreInputs, 0);
}

export const CUPPING_CATEGORIES = CATEGORY_VALUES;