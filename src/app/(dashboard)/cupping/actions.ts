"use server";

import { requireRole, requireTenantPrisma, getCurrentTenantId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";
import { Prisma, CuppingCategory } from "@prisma/client";
import { randomBytes } from "crypto";
import { computeScaTotal, scaGrade } from "@/lib/cupping-intelligence";

export type CuppingSessionRow = {
  id: string;
  code: string;
  date: string;
  location: string | null;
  evaluatorName: string | null;
  notes: string | null;
  batchId: string | null;
  lotId: string | null;
  batchCode: string | null;
  productName: string | null;
  /** Komposit SCA 0–100 (sama dengan totalScore; disimpan di DB sebagai cuppingSession.totalScore). */
  scaScore: number | null;
  /** Selalu SCA 0–100. */
  totalScore: number;
  /** Raw sum 11 kategori (0–110) untuk tampilan dial rata-rata. */
  rawScore: number;
  /** Raw max (110). */
  rawMax: number;
  maxScore: number;
  createdAt: string;
};

export type CuppingScoreRow = {
  id: string;
  category: CuppingCategory;
  score: number;
  maxScore: number;
  notes: string | null;
};

const REQUIRED_CATEGORIES = new Set<CuppingCategory>([
  "FRAGRANCE", "AROMA", "FLAVOR", "AFTERTASTE", "ACIDITY", "BODY",
  "BALANCE", "UNIFORMITY", "CLEAN_CUP", "SWEETNESS", "OVERALL",
]);

function generateCuppingCode(date: Date): string {
  const prefix = `CUPP-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
  return `${prefix}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function createCuppingSession(data: {
  batchId?: string;
  productId?: string;
  lotId?: string;
  defectCount?: number;
  date: Date;
  location?: string;
  evaluatorName?: string;
  notes?: string;
  scores: Array<{ category: CuppingCategory; score: number; maxScore?: number; notes?: string }>;
}): Promise<{ success: boolean; code?: string; scaScore?: number; error?: string }> {
  try {
    const user = await requireRole("OWNER", "MANAGER", "OPERATOR");
    const tenantPrisma = await requireTenantPrisma();
    const tenantId = await getCurrentTenantId();

    if (!data.batchId && !data.productId) {
      return { success: false, error: "Pilih batch atau produk yang dievaluasi." };
    }

    if (Number.isNaN(data.date.getTime())) {
      return { success: false, error: "Tanggal cupping tidak valid." };
    }
    const categories = new Set(data.scores.map((score) => score.category));
    if (data.scores.length !== REQUIRED_CATEGORIES.size || categories.size !== REQUIRED_CATEGORIES.size
      || [...REQUIRED_CATEGORIES].some((category) => !categories.has(category))) {
      return { success: false, error: "Semua kategori cupping wajib diisi tepat satu kali." };
    }
    if (data.scores.some((score) => !Number.isFinite(score.score) || score.score < 0 || score.score > 10)) {
      return { success: false, error: "Skor cupping harus berada antara 0 dan 10." };
    }
    const defectCount = data.defectCount ?? null;
    if (defectCount != null && (!Number.isInteger(defectCount) || defectCount < 0)) {
      return { success: false, error: "Jumlah defect harus bilangan bulat ≥ 0." };
    }
    // Lot opsional tapi harus milik tenant.
    const lotId: string | null = data.lotId ?? null;
    if (lotId) {
      const lot = await tenantPrisma.lot.findFirst({
        where: { id: lotId, tenantId },
        select: { id: true },
      });
      if (!lot) {
        return { success: false, error: "Lot green bean tidak ditemukan di tenant Anda." };
      }
    }

    // Komposit SCA 0–100 dihitung server agar konsisten & tak bisa dimanipulasi.
    const scoreByCategory = Object.fromEntries(
      data.scores.map((s) => [s.category, s.score]),
    ) as Partial<Record<CuppingCategory, number>>;
    const scaScore = computeScaTotal(scoreByCategory, defectCount);

    const code = generateCuppingCode(data.date);

    await tenantPrisma.$transaction(async (tx) => {
      const created = await tx.cuppingSession.create({
        data: {
          code,
          tenantId,
          batchId: data.batchId,
          productId: data.productId,
          lotId,
          defectCount,
          totalScore: scaScore,
          date: data.date,
          location: data.location,
          evaluatorName: data.evaluatorName,
          notes: data.notes,
        },
        include: {
          batch: true,
          product: true,
        },
      });

      await tx.cuppingScore.createMany({
        data: data.scores.map((s) => ({
          sessionId: created.id,
          category: s.category,
          score: new Prisma.Decimal(s.score),
          maxScore: new Prisma.Decimal(s.maxScore ?? 10),
          notes: s.notes,
        })),
      });

      await recordAudit(tx, {
        tenantId,
        userId: user.id,
        action: "CREATE",
        entityType: "CuppingSession",
        entityId: created.id,
        metadata: {
          code,
          batchId: data.batchId,
          productId: data.productId,
          lotId,
          defectCount,
          scaScore,
          grade: scaGrade(scaScore),
        },
      });

      return created;
    });

    revalidatePath("/cupping");
    revalidatePath("/dashboard");
    return { success: true, code, scaScore };
  } catch (error: any) {
    console.error("[createCuppingSession]", error);
    return { success: false, error: error.message || "Gagal menyimpan sesi cupping." };
  }
}

export async function getCuppingSessions(filters?: {
  batchId?: string;
  productId?: string;
  fromDate?: Date;
  toDate?: Date;
}): Promise<CuppingSessionRow[]> {
  try {
    const tenantPrisma = await requireTenantPrisma();
    const tenantId = await getCurrentTenantId();

    const where: Prisma.CuppingSessionWhereInput = {
      tenantId,
    };

    if (filters?.batchId) where.batchId = filters.batchId;
    if (filters?.productId) where.productId = filters.productId;
    if (filters?.fromDate || filters?.toDate) {
      where.date = {};
      if (filters.fromDate) where.date.gte = filters.fromDate;
      if (filters.toDate) where.date.lte = filters.toDate;
    }

    const sessions = await tenantPrisma.cuppingSession.findMany({
      where,
      include: {
        batch: { select: { code: true } },
        product: { select: { name: true } },
        scores: true,
      },
      orderBy: { date: "desc" },
      take: 50,
    });

    return sessions.map((session) => {
      const rawScore = session.scores.reduce((sum, s) => sum + Number(s.score), 0);
      const rawMax = session.scores.reduce((sum, s) => sum + Number(s.maxScore), 0);
      const sca = session.totalScore != null ? Number(session.totalScore) : null;
      return {
        id: session.id,
        code: session.code,
        date: session.date.toISOString(),
        location: session.location,
        evaluatorName: session.evaluatorName,
        notes: session.notes,
        batchId: session.batchId,
        lotId: session.lotId,
        batchCode: session.batch?.code ?? null,
        productName: session.product?.name ?? null,
        totalScore: sca ?? rawScore,
        rawScore,
        rawMax,
        maxScore: rawMax,
        scaScore: sca,
        createdAt: session.createdAt.toISOString(),
      };
    });
  } catch (error: any) {
    console.error("[getCuppingSessions]", error);
    return [];
  }
}

export async function getCuppingSession(id: string): Promise<{
  session: any;
  scores: CuppingScoreRow[];
} | null> {
  try {
    const tenantPrisma = await requireTenantPrisma();
    const tenantId = await getCurrentTenantId();

    const session = await tenantPrisma.cuppingSession.findFirst({
      where: { id, tenantId },
      include: {
        batch: true,
        product: true,
        scores: true,
      },
    });

    if (!session) return null;

    return {
      session: {
        id: session.id,
        code: session.code,
        date: session.date.toISOString(),
        location: session.location,
        evaluatorName: session.evaluatorName,
        notes: session.notes,
        batchCode: session.batch?.code ?? null,
        productName: session.product?.name ?? null,
      },
      scores: session.scores.map((s) => ({
        id: s.id,
        category: s.category,
        score: Number(s.score),
        maxScore: Number(s.maxScore),
        notes: s.notes,
      })),
    };
  } catch (error: any) {
    console.error("[getCuppingSession]", error);
    return null;
  }
}

export async function getCuppingFormOptions(): Promise<{
  batches: Array<{ id: string; code: string; label: string }>;
  products: Array<{ id: string; code: string; name: string }>;
  lots: Array<{ id: string; label: string }>;
}> {
  await requireRole("OWNER", "MANAGER", "OPERATOR");
  const tenantPrisma = await requireTenantPrisma();
  const [batches, products, lots] = await Promise.all([
    tenantPrisma.parentRoastingBatch.findMany({
      where: { status: { in: ["PENDING", "COMPLETED"] } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, code: true, outputProduct: { select: { name: true } } },
    }),
    tenantPrisma.product.findMany({
      where: { type: "ROASTED_BEAN", isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    }),
    // Lot green bean aktif (belum habis) untuk traceability cupping → lot.
    tenantPrisma.lot.findMany({
      where: {
        consumedAt: null,
        product: { type: "GREEN_BEAN" },
      },
      orderBy: { receivedAt: "desc" },
      take: 100,
      select: {
        id: true,
        batchCode: true,
        receivedAt: true,
        product: { select: { name: true } },
      },
    }),
  ]);
  return {
    batches: batches.map((batch) => ({
      id: batch.id,
      code: batch.code,
      label: `${batch.code} · ${batch.outputProduct.name}`,
    })),
    products,
    lots: lots.map((lot) => ({
      id: lot.id,
      label: `${lot.product?.name ?? "Green Bean"} · ${lot.batchCode} (${new Date(lot.receivedAt).toLocaleDateString("id-ID")})`,
    })),
  };
}
