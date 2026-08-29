"use server";

import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  getCurrentTenantId,
  getSystemUserId,
  requireCurrentUser,
  requireRole,
  requireTenantPrisma,
} from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { getCurrentDate, getZonedDayRange, getZonedMonthRange } from "@/lib/date-utils";
import { resolveSampleRatios, summarizeSampleUsage } from "@/lib/sample-usage";
import { appendFefoLedgerOut, appendLedger } from "@/lib/stock";
import { postSampleUsage, postVoidReversal } from "@/lib/posting";

export type SampleSourceType = "FINISHED_GOODS" | "RECIPE" | "CUSTOM_BLEND";

export type SampleFinishedGoodOption = {
  id: string;
  code: string;
  name: string;
  stockUnit: number;
  hppPerUnit: number;
  outputGrams: number | null;
};

export type SampleRecipeOption = {
  id: string;
  name: string;
  productName: string;
  outputGrams: number;
  packagingId: string;
  packagingName: string;
  items: Array<{
    productId: string;
    productName: string;
    ratioPercent: number;
  }>;
};

export type SampleRoastedBeanOption = {
  id: string;
  code: string;
  name: string;
  roastLevel: string | null;
  stockKg: number;
  avgCostPerKg: number;
};

export type SamplePackagingOption = {
  id: string;
  code: string;
  name: string;
  stockUnit: number;
  avgCostPerUnit: number;
};

export type SampleRow = {
  id: string;
  code: string;
  sourceType: SampleSourceType;
  sourceLabel: string;
  packCount: number;
  totalGrams: number;
  totalCost: number;
  recipient: string | null;
  notes: string | null;
  givenAt: string;
  givenBy: string;
  status: string;
  components: Array<{
    label: string;
    quantityKg: number | null;
    quantityUnit: number | null;
    ratioPercent: number | null;
  }>;
};

export type SamplePageData = {
  finishedGoods: SampleFinishedGoodOption[];
  recipes: SampleRecipeOption[];
  roastedBeans: SampleRoastedBeanOption[];
  packagings: SamplePackagingOption[];
  samples: SampleRow[];
  todaySummary: ReturnType<typeof summarizeSampleUsage>;
  monthSummary: ReturnType<typeof summarizeSampleUsage>;
  canVoid: boolean;
};

export type CreateSampleInput = {
  operationKey: string;
  sourceType: SampleSourceType;
  finishedProductId?: string;
  recipeId?: string;
  customLabel?: string;
  customComponents?: Array<{ productId: string; ratioPercent: number }>;
  packagingId?: string;
  gramsPerPack: number;
  packCount: number;
  recipient?: string;
  notes?: string;
};

const CreateSampleSchema = z.object({
  operationKey: z.string().uuid(),
  sourceType: z.enum(["FINISHED_GOODS", "RECIPE", "CUSTOM_BLEND"]),
  finishedProductId: z.string().optional(),
  recipeId: z.string().optional(),
  customLabel: z.string().trim().max(120).optional(),
  customComponents: z.array(z.object({
    productId: z.string().min(1),
    ratioPercent: z.number().positive().max(100),
  })).max(10).optional(),
  packagingId: z.string().optional(),
  gramsPerPack: z.number().int().positive().max(10_000),
  packCount: z.number().int().positive().max(1_000),
  recipient: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(1_000).optional(),
});

type PlannedComponent = {
  productId?: string;
  productType?: "GREEN_BEAN" | "ROASTED_BEAN" | "FINISHED_GOODS" | "PACKAGING";
  packagingId?: string;
  label: string;
  quantityKg?: number;
  quantityUnit?: number;
  ratioPercent?: number;
  unitCost: number;
  totalCost: number;
  refType: "SAMPLE_RB_OUT" | "SAMPLE_FG_OUT" | "SAMPLE_PKG_OUT";
};

export async function getSamplePageData(): Promise<SamplePageData> {
  const [tp, user, tenantId] = await Promise.all([
    requireTenantPrisma(),
    requireCurrentUser(),
    getCurrentTenantId(),
  ]);
  const tenant = await tp.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } });
  const today = getZonedDayRange(getCurrentDate(), tenant?.timezone ?? "Asia/Jakarta", 0);
  const [localYear, localMonth] = today.dateKey.split("-").map(Number);
  const month = getZonedMonthRange(localYear, localMonth, tenant?.timezone ?? "Asia/Jakarta");

  const [finishedProducts, recipesRaw, roastedProducts, packagingsRaw, samplesRaw, todayAggregate, monthAggregate] = await Promise.all([
    tp.product.findMany({
      where: { type: "FINISHED_GOODS", isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        stockUnit: true,
        lastHpp: true,
        recipes: {
          where: { isActive: true },
          take: 1,
          select: { outputGrams: true },
        },
      },
    }),
    tp.recipe.findMany({
      where: { isActive: true, product: { isActive: true } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        outputGrams: true,
        packagingId: true,
        packaging: { select: { name: true } },
        product: { select: { name: true } },
        items: {
          orderBy: { id: "asc" },
          select: {
            productId: true,
            ratioPercent: true,
            product: { select: { name: true } },
          },
        },
      },
    }),
    tp.product.findMany({
      where: { type: "ROASTED_BEAN", isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, roastLevel: true, stockKg: true, avgCostPerKg: true },
    }),
    tp.packaging.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, stockUnit: true, avgCostPerUnit: true, costPerUnit: true },
    }),
    tp.sampleUsage.findMany({
      orderBy: { givenAt: "desc" },
      take: 200,
      include: {
        createdBy: { select: { name: true } },
        components: { orderBy: { id: "asc" } },
      },
    }),
    tp.sampleUsage.aggregate({
      where: { status: "COMPLETED", givenAt: { gte: today.start, lt: today.end } },
      _count: { id: true },
      _sum: { packCount: true, totalGrams: true, totalCost: true },
    }),
    tp.sampleUsage.aggregate({
      where: { status: "COMPLETED", givenAt: { gte: month.start, lt: month.end } },
      _count: { id: true },
      _sum: { packCount: true, totalGrams: true, totalCost: true },
    }),
  ]);

  const samples: SampleRow[] = samplesRaw.map((sample) => ({
    id: sample.id,
    code: sample.code,
    sourceType: sample.sourceType as SampleSourceType,
    sourceLabel: sample.sourceLabel,
    packCount: sample.packCount,
    totalGrams: Number(sample.totalGrams),
    totalCost: Number(sample.totalCost),
    recipient: sample.recipient,
    notes: sample.notes,
    givenAt: sample.givenAt.toISOString(),
    givenBy: sample.createdBy.name,
    status: sample.status,
    components: sample.components.map((component) => ({
      label: component.label,
      quantityKg: component.quantityKg === null ? null : Number(component.quantityKg),
      quantityUnit: component.quantityUnit,
      ratioPercent: component.ratioPercent === null ? null : Number(component.ratioPercent),
    })),
  }));

  return {
    finishedGoods: finishedProducts.map((product) => ({
      id: product.id,
      code: product.code,
      name: product.name,
      stockUnit: product.stockUnit,
      hppPerUnit: Number(product.lastHpp ?? 0),
      outputGrams: product.recipes[0] ? Number(product.recipes[0].outputGrams) : null,
    })),
    recipes: recipesRaw.map((recipe) => ({
      id: recipe.id,
      name: recipe.name,
      productName: recipe.product.name,
      outputGrams: Number(recipe.outputGrams),
      packagingId: recipe.packagingId,
      packagingName: recipe.packaging.name,
      items: recipe.items.map((item) => ({
        productId: item.productId,
        productName: item.product.name,
        ratioPercent: Number(item.ratioPercent),
      })),
    })),
    roastedBeans: roastedProducts.map((product) => ({
      id: product.id,
      code: product.code,
      name: product.name,
      roastLevel: product.roastLevel,
      stockKg: Number(product.stockKg),
      avgCostPerKg: Number(product.avgCostPerKg ?? 0),
    })),
    packagings: packagingsRaw.map((packaging) => ({
      id: packaging.id,
      code: packaging.code,
      name: packaging.name,
      stockUnit: packaging.stockUnit,
      avgCostPerUnit: Number(packaging.avgCostPerUnit ?? packaging.costPerUnit ?? 0),
    })),
    samples,
    todaySummary: {
      transactionCount: todayAggregate._count.id,
      packCount: todayAggregate._sum.packCount ?? 0,
      totalGrams: Number(todayAggregate._sum.totalGrams ?? 0),
      totalCost: Number(todayAggregate._sum.totalCost ?? 0),
    },
    monthSummary: {
      transactionCount: monthAggregate._count.id,
      packCount: monthAggregate._sum.packCount ?? 0,
      totalGrams: Number(monthAggregate._sum.totalGrams ?? 0),
      totalCost: Number(monthAggregate._sum.totalCost ?? 0),
    },
    canVoid: user.role === "OWNER" || user.role === "MANAGER",
  };
}

export async function createSampleUsage(input: CreateSampleInput) {
  try {
    await requireRole("OWNER", "MANAGER", "CASHIER");
    const parsed = CreateSampleSchema.parse(input);
    const totalGrams = parsed.gramsPerPack * parsed.packCount;
    if (!Number.isSafeInteger(totalGrams) || totalGrams > 1_000_000) {
      return { success: false as const, error: "Total gram sample tidak valid." };
    }

    const [tenantId, userId, tp] = await Promise.all([
      getCurrentTenantId(),
      getSystemUserId(),
      requireTenantPrisma(),
    ]);
    const existing = await tp.sampleUsage.findFirst({
      where: { operationKey: parsed.operationKey },
      select: { code: true },
    });
    if (existing) return { success: true as const, sampleCode: existing.code };

    const now = getCurrentDate();
    const prefix = `SMP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const sampleCode = `${prefix}-${randomBytes(4).toString("hex").toUpperCase()}`;
    const components: PlannedComponent[] = [];

    const result = await tp.$transaction(async (tx) => {
      let sourceLabel = "Sample";

      if (parsed.sourceType === "FINISHED_GOODS") {
        if (!parsed.finishedProductId) throw new Error("Produk jadi wajib dipilih.");
        const product = await tx.product.findUnique({
          where: { id: parsed.finishedProductId },
          select: {
            id: true,
            name: true,
            type: true,
            isActive: true,
            lastHpp: true,
            recipes: { where: { isActive: true }, take: 1, select: { outputGrams: true } },
          },
        });
        if (!product?.isActive || product.type !== "FINISHED_GOODS") throw new Error("Produk jadi tidak valid.");
        const recipeGrams = product.recipes[0] ? Number(product.recipes[0].outputGrams) : null;
        if (recipeGrams !== null && Math.abs(recipeGrams - parsed.gramsPerPack) > 0.01) {
          throw new Error(`Ukuran produk jadi adalah ${recipeGrams.toLocaleString("id-ID")}g per pack.`);
        }
        const unitCost = Number(product.lastHpp ?? 0);
        sourceLabel = product.name;
        components.push({
          productId: product.id,
          productType: product.type,
          label: product.name,
          quantityUnit: parsed.packCount,
          unitCost,
          totalCost: unitCost * parsed.packCount,
          refType: "SAMPLE_FG_OUT",
        });
      } else {
        let ratios: Array<{ productId: string; ratioPercent: number }>;
        let effectivePackagingId = parsed.packagingId;
        if (parsed.sourceType === "RECIPE") {
          if (!parsed.recipeId) throw new Error("Resep blend wajib dipilih.");
          const recipe = await tx.recipe.findUnique({
            where: { id: parsed.recipeId },
            include: { product: true, items: { include: { product: true }, orderBy: { id: "asc" } } },
          });
          if (!recipe?.isActive || !recipe.product.isActive || recipe.items.length === 0) throw new Error("Resep tidak valid atau sudah nonaktif.");
          sourceLabel = recipe.product.name;
          effectivePackagingId ||= recipe.packagingId;
          ratios = recipe.items.map((item) => ({ productId: item.productId, ratioPercent: Number(item.ratioPercent) }));
        } else {
          sourceLabel = parsed.customLabel?.trim() || "Custom Blend";
          ratios = parsed.customComponents ?? [];
        }

        const resolvedRatios = resolveSampleRatios(totalGrams, ratios);
        const products = await tx.product.findMany({
          where: { id: { in: resolvedRatios.map((item) => item.productId) }, type: "ROASTED_BEAN", isActive: true },
          select: { id: true, name: true, avgCostPerKg: true },
        });
        if (products.length !== resolvedRatios.length) throw new Error("Salah satu roasted bean tidak valid atau sudah nonaktif.");
        const productMap = new Map(products.map((product) => [product.id, product]));
        for (const ratio of resolvedRatios) {
          const product = productMap.get(ratio.productId)!;
          const unitCost = Number(product.avgCostPerKg ?? 0);
          components.push({
            productId: product.id,
            productType: "ROASTED_BEAN",
            label: product.name,
            quantityKg: ratio.quantityKg,
            ratioPercent: ratio.ratioPercent,
            unitCost,
            totalCost: unitCost * ratio.quantityKg,
            refType: "SAMPLE_RB_OUT",
          });
        }

        if (effectivePackagingId) {
          const packaging = await tx.packaging.findUnique({
            where: { id: effectivePackagingId },
            select: { id: true, name: true, isActive: true, avgCostPerUnit: true, costPerUnit: true },
          });
          if (!packaging?.isActive) throw new Error("Kemasan sample tidak valid atau sudah nonaktif.");
          const unitCost = Number(packaging.avgCostPerUnit ?? packaging.costPerUnit ?? 0);
          components.push({
            packagingId: packaging.id,
            productType: "PACKAGING",
            label: packaging.name,
            quantityUnit: parsed.packCount,
            unitCost,
            totalCost: unitCost * parsed.packCount,
            refType: "SAMPLE_PKG_OUT",
          });
        }
      }

      const totalCost = components.reduce((sum, component) => sum + component.totalCost, 0);
      const sample = await tx.sampleUsage.create({
        data: {
          tenantId,
          code: sampleCode,
          operationKey: parsed.operationKey,
          sourceType: parsed.sourceType,
          sourceLabel,
          packCount: parsed.packCount,
          totalGrams,
          totalCost,
          recipient: parsed.recipient || null,
          notes: parsed.notes || null,
          givenAt: now,
          status: "COMPLETED",
          createdById: userId,
        },
      });

      await tx.sampleUsageComponent.createMany({
        data: components.map((component) => ({
          tenantId,
          sampleUsageId: sample.id,
          productId: component.productId,
          packagingId: component.packagingId,
          label: component.label,
          quantityKg: component.quantityKg,
          quantityUnit: component.quantityUnit,
          ratioPercent: component.ratioPercent,
          unitCost: component.unitCost,
          totalCost: component.totalCost,
        })),
      });

      for (const component of components) {
        await appendFefoLedgerOut(tx, {
            tenantId,
            productId: component.productId,
            packagingId: component.packagingId,
            refType: component.refType,
            refId: sample.id,
            quantityKg: component.quantityKg,
            quantityUnit: component.quantityUnit,
            notes: `Sample ${sampleCode}: ${sourceLabel}`,
            createdById: userId,
        });
      }

      await recordAudit(tx, {
        tenantId,
        userId,
        action: "CREATE",
        entityType: "SampleUsage",
        entityId: sample.id,
        after: { code: sample.code, sourceType: sample.sourceType, sourceLabel, packCount: sample.packCount, totalGrams, totalCost },
        metadata: { operationKey: parsed.operationKey, componentCount: components.length },
      });

      await postSampleUsage(
        sample.id,
        Number(sample.totalCost),
        components.map((component) => ({
          productType: component.productType,
          totalCost: Number(component.totalCost),
        })),
        { tx, tenantId, userId },
      );
      return sample;
    }, { isolationLevel: "Serializable" });

    revalidateSamplePaths();

    return { success: true as const, sampleCode: result.code };
  } catch (error) {
    console.error("[createSampleUsage]", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && input.operationKey) {
      const existing = await (await requireTenantPrisma()).sampleUsage.findFirst({
        where: { operationKey: input.operationKey },
        select: { code: true },
      });
      if (existing) return { success: true as const, sampleCode: existing.code };
    }
    return {
      success: false as const,
      error: error instanceof z.ZodError
        ? "Data sample tidak valid."
        : error instanceof Error
          ? error.message
          : "Gagal mencatat sample.",
    };
  }
}

export async function voidSampleUsage(sampleId: string, reason: string) {
  try {
    await requireRole("OWNER", "MANAGER");
    if (!reason.trim()) return { success: false as const, error: "Alasan void wajib diisi." };
    const [tenantId, userId, tp] = await Promise.all([
      getCurrentTenantId(),
      getSystemUserId(),
      requireTenantPrisma(),
    ]);

    await tp.$transaction(async (tx) => {
      const sample = await tx.sampleUsage.findFirst({ where: { id: sampleId, tenantId } });
      if (!sample) throw new Error("Transaksi sample tidak ditemukan.");
      if (sample.status === "VOID") throw new Error("Transaksi sample sudah di-void.");
      const sourceEntries = await tx.inventoryLedger.findMany({
        where: {
          refId: sample.id,
          entryType: "OUT",
          refType: { in: ["SAMPLE_RB_OUT", "SAMPLE_FG_OUT", "SAMPLE_PKG_OUT"] },
        },
      });
      if (sourceEntries.length === 0) throw new Error("Ledger sample tidak lengkap; void dibatalkan.");

      for (const entry of sourceEntries) {
        await appendLedger(tx, {
          data: {
            tenantId,
            productId: entry.productId,
            packagingId: entry.packagingId,
            entryType: "IN",
            refType: "VOID_REVERSAL",
            refId: sample.id,
            reversalOfLedgerId: entry.id,
            quantityKg: entry.quantityKg,
            quantityUnit: entry.quantityUnit,
            lotId: entry.lotId,
            lotNumber: entry.lotNumber,
            expiryDate: entry.expiryDate,
            notes: `VOID sample: ${sample.code}`,
            createdById: userId,
          },
        });
        if (entry.lotId) {
          await tx.lot.update({ where: { id: entry.lotId }, data: { consumedAt: null } });
        }
      }
      await tx.sampleUsage.update({
        where: { id: sample.id },
        data: { status: "VOID", voidReason: reason.trim(), voidAt: getCurrentDate() },
      });
      await postVoidReversal("SAMPLE_USAGE", sample.id, reason, { tx, tenantId, userId });
      await recordAudit(tx, {
        tenantId,
        userId,
        action: "VOID",
        entityType: "SampleUsage",
        entityId: sample.id,
        before: { status: sample.status, totalCost: Number(sample.totalCost) },
        after: { status: "VOID", reason: reason.trim() },
      });
    }, { isolationLevel: "Serializable" });

    revalidateSamplePaths();
    return { success: true as const };
  } catch (error) {
    console.error("[voidSampleUsage]", error);
    return { success: false as const, error: error instanceof Error ? error.message : "Gagal void sample." };
  }
}

function revalidateSamplePaths() {
  revalidatePath("/dashboard");
  revalidatePath("/inventory");
  revalidatePath("/penjualan");
  revalidatePath("/keuangan");
  revalidatePath("/laporan");
}
