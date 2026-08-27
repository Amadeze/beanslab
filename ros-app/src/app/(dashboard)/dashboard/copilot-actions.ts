"use server";

import { requireTenantPrisma, requireRole } from "@/lib/auth";
import { buildReorderDraftLine } from "@/lib/lot-intelligence";
import { getBatchReorderSummaries } from "@/lib/reorder";
import {
  buildRoasteryInsights,
  summarizeInsights,
  type CopilotInsight,
} from "@/lib/roastery-intelligence";

/**
 * Kumpulkan fakta operasional tenant lalu bangun insight deterministik untuk
 * panel AI Copilot di dasbor. Tanpa LLM — $0 dan bisa di-cache.
 */
export async function getCopilotInsights(): Promise<CopilotInsight[]> {
  const tenantPrisma = await requireTenantPrisma();
  await requireRole("OWNER", "MANAGER", "OPERATOR");

  const [lots, cupping, reorderData] = await Promise.all([
    tenantPrisma.lot.findMany({
      where: { consumedAt: null, product: { type: "GREEN_BEAN" } },
      orderBy: { receivedAt: "desc" },
      take: 50,
      select: {
        id: true,
        batchCode: true,
        qcStatus: true,
        defectCount: true,
        moisturePct: true,
      },
    }),
    tenantPrisma.cuppingSession.findMany({
      where: {},
      orderBy: { date: "desc" },
      take: 50,
      select: {
        id: true,
        code: true,
        totalScore: true,
        defectCount: true,
        lotId: true,
      },
    }),
    getBatchReorderSummaries(tenantPrisma),
  ]);

  // Reorder hijau: pakai ringkasan reorder riil (avgDailyUsage & leadTimeDays)
  // supaya saran kuantitas menutup kebutuhan lead time, bukan sekadar safety top-up.
  const reorder = reorderData.productSummaries
    .filter(
      (p) =>
        p.skuType === "GREEN_BEAN" &&
        (p.status === "perlu_pesan" || p.status === "habis"),
    )
    .map((p) =>
      buildReorderDraftLine({
        subjectKind: "PRODUCT",
        subjectId: p.skuId,
        name: p.skuName,
        avgDailyUsage: p.averageDailyUsage,
        leadTimeDays: p.leadTimeDays,
        safetyStockQuantity: p.safetyStockQuantity,
        currentStock: p.currentStock,
        unitLabel: "kg",
      }),
    )
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .map((d) => ({
      subjectKind: d.subjectKind,
      subjectId: d.subjectId,
      name: d.name,
      suggestedQuantity: d.suggestedQuantity,
      unitLabel: d.unitLabel,
    }));

  return buildRoasteryInsights({
    lots: lots.map((l) => ({
      id: l.id,
      code: l.batchCode || l.id,
      qcStatus: l.qcStatus,
      defectCount: l.defectCount,
      moisturePct: l.moisturePct != null ? Number(l.moisturePct) : null,
    })),
    cupping: cupping.map((c) => ({
      id: c.id,
      code: c.code,
      totalScore: c.totalScore != null ? Number(c.totalScore) : null,
      defectCount: c.defectCount,
      lotId: c.lotId,
    })),
    reorder,
  });
}

export type CopilotNarrative = { text: string; source: "deterministic" | "llm" };

/**
 * Narasi bahasa alami untuk insight. Default deterministik (gratis).
 * Bila ROASTD_LLM_BASE_URL diisi (Ollama/self-host), coba hasilkan narasi LLM;
 * gagal/timeout → fallback deterministik. Tanpa API berbayar.
 */
export async function generateCopilotNarrative(
  insights: CopilotInsight[],
): Promise<CopilotNarrative> {
  const base = summarizeInsights(insights);
  const baseUrl = process.env.ROASTD_LLM_BASE_URL;
  if (!baseUrl) return { text: base, source: "deterministic" };

  try {
    const model = process.env.ROASTD_LLM_MODEL || "llama3";
    const prompt =
      "Berikan ringkasan operasional singkat (maks 4 kalimat, bahasa Indonesia) " +
      "untuk seorang pemilik roastery berdasar sinyal berikut:\n" +
      base;
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { text: base, source: "deterministic" };
    const json = (await res.json()) as { response?: string };
    return { text: json.response?.trim() || base, source: "llm" };
  } catch {
    return { text: base, source: "deterministic" };
  }
}
