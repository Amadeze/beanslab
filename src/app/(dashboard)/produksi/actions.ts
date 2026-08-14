"use server";

import { revalidatePath } from "next/cache";
import { appendFefoLedgerOut, appendLedger } from "@/lib/stock";
import { allocateProducedStockToDemand } from "@/lib/storefront-commerce";
import { getCurrentTenantId, getSystemUserId, requireRole, requireTenantPrisma } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { randomBytes } from "crypto";
import { normalizeProductionComponents } from "@/lib/operations";
import { getCurrentDate } from "@/lib/date-utils";
import { postProductionBatch, postVoidReversal } from "@/lib/posting";
import { createLotPlacementInTx } from "@/lib/storage-location";
import { Prisma } from "@prisma/client";

// =============================================================================
// TYPES
// =============================================================================

/** Satu komponen RB dalam produksi (actual — bukan template resep). */
export type RBComponentInput = {
  productId: string;
  productName: string;   // hanya untuk display; server validasi via productId
  actualGrams: number;   // total gram yang BENAR-BENAR dipakai dalam batch ini
};

/** Satu komponen supply dalam produksi (actual — bukan template resep). */
export type SupplyComponentInput = {
  supplyItemId: string;
  quantity: number;       // total quantity baseUnit yang BENAR-BENAR dipakai dalam batch ini
};

export type CreateProductionBatchInput = {
  operationKey: string;
  outputProductId: string;
  recipeId?: string;
  packagingId?: string;
  packagingSupplyItemId?: string;
  unitsProduced: number;
  rbComponents: RBComponentInput[];
  supplyComponents?: SupplyComponentInput[];
  laborCost?: number;
  overheadAllocated?: number;
  notes?: string;
  destinationLocationId?: string | null;
  /** Link opsional ke batch roasting yang menghasilkan RB yang dipakai. */
  parentRoastBatchId?: string | null;
};

export type ProductionActionResult =
  | { success: true; batchCode: string }
  | { success: false; error: string };

// ── Page data ──

export type FGProductOption = {
  id: string;
  code: string;
  name: string;
  /** Recipe terkait jika ada, berisi saran komponen */
  recipe: RecipeSuggestion | null;
};

export type RecipeSuggestion = {
  id: string;
  outputGrams: number;
  packagingId: string;
  packagingName: string;
  /** Canonical packaging supply item (nullable bila kemasan recipe belum dimapping). */
  packagingSupplyItemId: string | null;
  items: RecipeItemSuggestion[];
  supplyItems: RecipeSupplySuggestion[];
};

export type RecipeSupplySuggestion = {
  supplyItemId: string;
  supplyItemName: string;
  quantityPerUnit: number; // kuantitas supply per 1 unit output (baseUnit item)
};

export type RecipeItemSuggestion = {
  productId: string;
  productName: string;
  ratioPercent: number;
  gramsPerUnit: number;  // gram RB per 1 unit output (dari resep)
};

export type RBStockOption = {
  id: string;
  name: string;
  roastLevel: string | null;
  stockKg: number;
  avgCostPerKg: number;
};

export type PackagingOption = {
  id: string;               // InventorySupplyItem id (canonical selection)
  code: string;
  name: string;
  baseUnit: string;
  costPerUnit: number;
  stockUnit: number;
  /** Suggested net coffee weight for one pack, when configured on the supply item. */
  capacityGrams: number | null;
  /** Legacy packaging adapter id (untuk resolve internal di server). */
  packagingId: string;
};

export type SupplyConsumptionOption = {
  id: string;
  code: string;
  name: string;
  baseUnit: string;
  costPerUnit: number;
  stockQuantity: number;
};

export type ProductionBatchRow = {
  id: string;
  code: string;
  outputProductName: string;
  packagingName: string;
  unitsProduced: number;
  totalRbUsedKg: number;
  hppPerUnit: number;
  laborCost: number;
  overheadAllocated: number;
  producedAt: string;
  status: string;
  notes: string | null;
  recipeUsed: string | null;
  parentRoastBatchId: string | null;
  parentRoastBatchCode: string | null;
};

export type ProductionPageData = {
  batches: ProductionBatchRow[];
  fgOptions: FGProductOption[];
  rbOptions: RBStockOption[];
  packagingOptions: PackagingOption[];
  supplyOptions: SupplyConsumptionOption[];
};

// =============================================================================
// HELPERS
// =============================================================================


async function generateBatchCode(): Promise<string> {
  const now = getCurrentDate();
  const prefix = `PRD-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const randStr = randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}-${randStr}`;
}

// =============================================================================
// QUERIES
// =============================================================================

async function fetchFGOptions(): Promise<FGProductOption[]> {
  const products = await (await requireTenantPrisma()).product.findMany({
    where: { type: "FINISHED_GOODS", isActive: true },
    include: {
      recipes: {
        where: { isActive: true },
        take: 1,
        include: {
          packaging: { select: { id: true, name: true, supplyItemId: true } },
          items: {
            include: {
              product: { select: { id: true, name: true } },
            },
          },
          supplyItems: {
            include: {
              supplyItem: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return products.map((p) => {
    const recipe = p.recipes[0] ?? null;
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      recipe: recipe
        ? {
            id: recipe.id,
            outputGrams: Number(recipe.outputGrams),
            packagingId: recipe.packagingId,
            packagingName: recipe.packaging.name,
            packagingSupplyItemId: recipe.packaging.supplyItemId ?? null,
            items: recipe.items.map((item) => ({
              productId: item.productId,
              productName: item.product.name,
              ratioPercent: Number(item.ratioPercent),
              gramsPerUnit: Number(item.gramsPerUnit),
            })),
            supplyItems: recipe.supplyItems.map((item) => ({
              supplyItemId: item.supplyItemId,
              supplyItemName: item.supplyItem.name,
              quantityPerUnit: Number(item.quantityPerUnit),
            })),
          }
        : null,
    };
  });
}

async function fetchRBOptions(): Promise<RBStockOption[]> {
  const products = await (await requireTenantPrisma()).product.findMany({
    where: { type: { in: ["ROASTED_BEAN", "GREEN_BEAN"] }, isActive: true },
    select: { id: true, name: true, roastLevel: true, stockKg: true, avgCostPerKg: true },
    orderBy: { name: "asc" },
  });

  return products
    .map((p) => ({
      id: p.id,
      name: p.name,
      roastLevel: p.roastLevel,
      stockKg: Number(p.stockKg),
      avgCostPerKg: Number(p.avgCostPerKg),
    }))
    .filter((p) => p.stockKg > 0);
}

async function fetchPackagingOptions(): Promise<PackagingOption[]> {
  const items = await (await requireTenantPrisma()).inventorySupplyItem.findMany({
    where: { category: "PACKAGING", isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      baseUnit: true,
      costPerUnit: true,
      avgCostPerUnit: true,
      stockQuantity: true,
      capacityGrams: true,
      packaging: { select: { id: true } },
    },
    orderBy: { name: "asc" },
  });
  return items
    .filter((item) => item.packaging && Number(item.stockQuantity) > 0)
    .map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      baseUnit: item.baseUnit,
      costPerUnit: Number(item.avgCostPerUnit ?? item.costPerUnit),
      stockUnit: Number(item.stockQuantity),
      capacityGrams: item.capacityGrams === null ? null : Number(item.capacityGrams),
      packagingId: item.packaging!.id,
    }));
}

async function fetchSupplyOptions(): Promise<SupplyConsumptionOption[]> {
  const items = await (await requireTenantPrisma()).inventorySupplyItem.findMany({
    where: { isActive: true, consumableInProduction: true },
    select: {
      id: true,
      code: true,
      name: true,
      baseUnit: true,
      costPerUnit: true,
      avgCostPerUnit: true,
      stockQuantity: true,
    },
    orderBy: { name: "asc" },
  });
  return items
    .filter((item) => Number(item.stockQuantity) > 0)
    .map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      baseUnit: item.baseUnit,
      costPerUnit: Number(item.avgCostPerUnit ?? item.costPerUnit),
      stockQuantity: Number(item.stockQuantity),
    }));
}

async function fetchBatchHistory(): Promise<ProductionBatchRow[]> {
  const batches = await (await requireTenantPrisma()).productionBatch.findMany({
    orderBy: { producedAt: "desc" },
    take: 100,
    include: {
      outputProduct: { select: { name: true } },
      packaging:     { select: { name: true } },
      recipe:        { select: { name: true } },
      parentRoastBatch: { select: { id: true, code: true } },
    },
  });

  return batches.map((b) => ({
    id: b.id,
    code: b.code,
    outputProductName: b.outputProduct.name,
    packagingName:     b.packaging.name,
    unitsProduced:     b.unitsProduced,
    totalRbUsedKg:     Number(b.totalRbUsedKg),
    hppPerUnit:        Number(b.hppPerUnit),
    laborCost:         Number(b.laborCost ?? 0),
    overheadAllocated: Number(b.overheadAllocated ?? 0),
    producedAt:        b.producedAt.toISOString(),
    status:            b.status,
    notes:             b.notes,
    recipeUsed:        b.recipe?.name ?? null,
    parentRoastBatchId: b.parentRoastBatch?.id ?? null,
    parentRoastBatchCode: b.parentRoastBatch?.code ?? null,
  }));
}

// =============================================================================
// PUBLIC SERVER ACTIONS
// =============================================================================

export async function getProductionPageData(): Promise<ProductionPageData> {
  await requireRole("OWNER", "MANAGER", "OPERATOR");
  const [batches, fgOptions, rbOptions, packagingOptions, supplyOptions] = await Promise.all([
    fetchBatchHistory(),
    fetchFGOptions(),
    fetchRBOptions(),
    fetchPackagingOptions(),
    fetchSupplyOptions(),
  ]);
  return { batches, fgOptions, rbOptions, packagingOptions, supplyOptions };
}

/**
 * Catat Batch Produksi.
 *
 * ACID transaction:
 *   1. Validasi: setiap komponen RB stok cukup
 *   2. Validasi: packaging stok cukup
 *   3. Hitung HPP snapshot = (sum RB cost + packaging cost) / unitsProduced
 *   4. INSERT ProductionBatch
 *   5. For each RB component → INSERT InventoryLedger: RB OUT
 *   6. INSERT InventoryLedger: PKG OUT
 *   7. INSERT InventoryLedger: FG IN
 */
export async function createProductionBatch(
  input: CreateProductionBatchInput
): Promise<ProductionActionResult> {
  try {
    await requireRole("OWNER", "MANAGER", "OPERATOR");
    if (!input.operationKey || !/^[0-9a-f-]{36}$/i.test(input.operationKey)) {
      return { success: false, error: "Identitas transaksi tidak valid. Buka ulang form lalu coba lagi." };
    }
    if (input.rbComponents.length === 0) {
      return { success: false, error: "Minimal satu komponen Roasted Bean diperlukan." };
    }
    if (!Number.isInteger(input.unitsProduced) || input.unitsProduced < 1 || input.unitsProduced > 1_000_000) {
      return { success: false, error: "Jumlah unit yang diproduksi minimal 1." };
    }
    const normalizedComponents = normalizeProductionComponents(input.rbComponents);

    const userId = await getSystemUserId();
    const tenantId = await getCurrentTenantId();
    const tenantPrisma = await requireTenantPrisma();
    const previousAttempt = await tenantPrisma.productionBatch.findFirst({
      where: { operationKey: input.operationKey },
      select: { code: true },
    });
    if (previousAttempt) return { success: true, batchCode: previousAttempt.code };

    // 5. ACID transaction (includes validation + execution atomically)
    return await tenantPrisma.$transaction(async (tx) => {
      // 1a. Resolve kemasan: canonical InventorySupplyItem (kategori PACKAGING)
      //     bila form memilih item non-kopi; packagingId legacy di-resolve di sini.
      const supplyPackaging = input.packagingSupplyItemId
        ? await tx.inventorySupplyItem.findUnique({
            where: { id: input.packagingSupplyItemId },
            select: {
              id: true,
              code: true,
              name: true,
              category: true,
              isActive: true,
              trackLot: true,
              costPerUnit: true,
              avgCostPerUnit: true,
              stockQuantity: true,
              tenantId: true,
              packaging: { select: { id: true } },
            },
          })
        : null;

      if (input.packagingSupplyItemId) {
        if (!supplyPackaging || supplyPackaging.tenantId !== tenantId) {
          return { success: false, error: "Kemasan (item non-kopi) tidak ditemukan atau tidak termasuk dalam tenant ini." };
        }
        if (!supplyPackaging.isActive) {
          return { success: false, error: `Kemasan "${supplyPackaging.name}" sudah nonaktif.` };
        }
        if (supplyPackaging.category !== "PACKAGING") {
          return { success: false, error: `Item "${supplyPackaging.name}" bukan kategori PACKAGING.` };
        }
        if (!supplyPackaging.packaging) {
          return {
            success: false,
            error: `Kemasan "${supplyPackaging.name}" belum terhubung ke data legacy. Perbarui di Master Data → Persediaan Non-Kopi.`,
          };
        }
      }

      if (!supplyPackaging && !input.packagingId) {
        return { success: false, error: "Kemasan wajib dipilih." };
      }

      const resolvedPackagingId: string = supplyPackaging?.packaging!.id ?? input.packagingId!;

      // 1. Ambil data packaging (legacy adapter) untuk referensi & HPP
      const [packaging, outputProduct, recipe] = await Promise.all([
        tx.packaging.findUnique({
          where: { id: resolvedPackagingId },
          select: { id: true, name: true, costPerUnit: true, avgCostPerUnit: true, isActive: true, stockUnit: true },
        }),
        tx.product.findUnique({
          where: { id: input.outputProductId },
          select: { id: true, name: true, type: true, isActive: true },
        }),
        input.recipeId
          ? tx.recipe.findUnique({
              where: { id: input.recipeId },
              select: { id: true, productId: true, isActive: true },
            })
          : null,
      ]);
      if (!packaging) return { success: false, error: "Packaging tidak ditemukan." };
      if (!packaging.isActive) return { success: false, error: "Packaging sudah nonaktif." };
      if (!outputProduct || !outputProduct.isActive || outputProduct.type !== "FINISHED_GOODS") {
        return { success: false, error: "Produk output harus Finished Goods aktif." };
      }
      if (input.recipeId && (!recipe || !recipe.isActive || recipe.productId !== input.outputProductId)) {
        return { success: false, error: "Resep tidak valid untuk produk output yang dipilih." };
      }

      // 2. Validasi stok kemasan (canonical dari supply item bila ter-mapping)
      const pkgStock = supplyPackaging ? Number(supplyPackaging.stockQuantity) : packaging.stockUnit;
      if (pkgStock < input.unitsProduced) {
        return {
          success: false,
          error: `Stok kemasan "${supplyPackaging?.name ?? packaging.name}" tidak cukup. Tersedia: ${pkgStock} pcs, dibutuhkan: ${input.unitsProduced} pcs.`,
        };
      }

      // 3. Validasi & hitung HPP setiap komponen RB
      let totalRbCost = 0;
      let totalRbUsedKg = 0;

      const rbDetails: Array<{
        productId: string;
        actualKg: number;
        hppPerKg: number;
      }> = [];

      for (const { productId, actualGrams } of normalizedComponents) {
        const actualKg = actualGrams / 1000;
        if (actualKg <= 0) continue;

        const rbProduct = await tx.product.findUnique({
          where: { id: productId },
          select: { name: true, type: true, isActive: true, stockKg: true, avgCostPerKg: true },
        });
        if (
          !rbProduct ||
          !rbProduct.isActive ||
          !["GREEN_BEAN", "ROASTED_BEAN"].includes(rbProduct.type)
        ) {
          return { success: false, error: "Komponen bahan baku tidak valid atau sudah nonaktif." };
        }

        // Validasi stok RB
        const rbStock = Number(rbProduct.stockKg);
        if (rbStock < actualKg) {
          return {
            success: false,
            error: `Stok "${rbProduct.name}" tidak cukup. Tersedia: ${rbStock.toFixed(3)} kg, dibutuhkan: ${actualKg.toFixed(3)} kg.`,
          };
        }
        
        const hppPerKg = Number(rbProduct.avgCostPerKg ?? 0);

        if (hppPerKg <= 0) {
          return {
            success: false,
            error: `Biaya bahan "${rbProduct.name}" belum tercatat (avgCostPerKg = 0). Periksa data pembelian/roasting terlebih dahulu.`,
          };
        }

        totalRbCost += hppPerKg * actualKg;
        totalRbUsedKg += actualKg;
        rbDetails.push({ productId, actualKg, hppPerKg });
      }

      if (totalRbUsedKg === 0) {
        return { success: false, error: "Total berat Roasted Bean yang digunakan adalah 0." };
      }

      // Traceability: bila produksi dimulai dari rekap batch roasting, pastikan
      // tautannya valid (tenant sama, COMPLETED, dan hasil RB-nya benar-benar dipakai).
      let resolvedParentRoastBatchId: string | null = null;
      if (input.parentRoastBatchId) {
        const parentRoast = await tx.parentRoastingBatch.findUnique({
          where: { id: input.parentRoastBatchId, tenantId },
          select: { id: true, status: true, outputProductId: true },
        });
        if (!parentRoast) {
          return { success: false, error: "Batch roasting sumber tidak ditemukan untuk tenant ini." };
        }
        if (parentRoast.status !== "COMPLETED") {
          return { success: false, error: "Batch roasting sumber belum selesai (COMPLETED)." };
        }
        const usesOutput = rbDetails.some((d) => d.productId === parentRoast.outputProductId);
        if (!usesOutput) {
          return {
            success: false,
            error: "Produksi harus menggunakan hasil Roasted Bean dari batch roasting tersebut sebagai komponen.",
          };
        }
        resolvedParentRoastBatchId = parentRoast.id;
      }

      // 3b. Validasi & hitung HPP setiap komponen supply
      let totalSupplyCost = 0;
      const supplyDetails: Array<{
        supplyItemId: string;
        quantity: number;
        unitCostSnapshot: number;
        totalCostSnapshot: number;
        trackLot: boolean;
        includeInProductHpp: boolean;
      }> = [];

      const supplyComponents = input.supplyComponents ?? [];
      const supplyComponentIds = new Set<string>();

      for (const sc of supplyComponents) {
        if (!sc.supplyItemId) continue;
        if (supplyComponentIds.has(sc.supplyItemId)) {
          return { success: false, error: "Setiap supply item hanya boleh muncul sekali dalam batch." };
        }
        supplyComponentIds.add(sc.supplyItemId);

        const qty = Number(sc.quantity);
        if (!Number.isFinite(qty) || qty <= 0) {
          return { success: false, error: "Quantity supply harus lebih besar dari 0." };
        }

        const supplyItem = await tx.inventorySupplyItem.findUnique({
          where: { id: sc.supplyItemId },
          select: {
            id: true,
            code: true,
            name: true,
            isActive: true,
            consumableInProduction: true,
            includeInProductHpp: true,
            trackLot: true,
            avgCostPerUnit: true,
            stockQuantity: true,
            tenantId: true,
          },
        });

        if (!supplyItem || supplyItem.tenantId !== tenantId) {
          return { success: false, error: "Supply item tidak ditemukan atau tidak termasuk dalam tenant ini." };
        }
        if (!supplyItem.isActive) {
          return { success: false, error: `Supply item "${supplyItem.name}" sudah nonaktif.` };
        }
        if (!supplyItem.consumableInProduction) {
          return { success: false, error: `Supply item "${supplyItem.name}" tidak diizinkan untuk produksi.` };
        }

        const currentStock = Number(supplyItem.stockQuantity ?? 0);
        if (currentStock < qty) {
          return {
            success: false,
            error: `Stok supply "${supplyItem.name}" tidak cukup. Tersedia: ${currentStock.toFixed(3)} ${supplyItem.code}, dibutuhkan: ${qty.toFixed(3)}.`,
          };
        }

        const unitCost = Number(supplyItem.avgCostPerUnit ?? 0);
        if (unitCost <= 0) {
          return {
            success: false,
            error: `Biaya supply "${supplyItem.name}" belum tercatat (avgCostPerUnit = 0). Periksa data pembelian terlebih dahulu.`,
          };
        }

        const totalCost = unitCost * qty;
        if (supplyItem.includeInProductHpp) {
          totalSupplyCost += totalCost;
        }
        supplyDetails.push({
          supplyItemId: sc.supplyItemId,
          quantity: qty,
          unitCostSnapshot: unitCost,
          totalCostSnapshot: totalCost,
          trackLot: supplyItem.trackLot,
          includeInProductHpp: supplyItem.includeInProductHpp,
        });
      }

      // Sanity check: prevent unrealistic supply-to-FG ratio
      const MAX_UNITS_PER_SUPPLY_UNIT = 10_000;
      for (const sd of supplyDetails) {
        if (input.unitsProduced > sd.quantity * MAX_UNITS_PER_SUPPLY_UNIT) {
          return {
            success: false,
            error: `Jumlah produksi terlalu besar untuk qty supply ${sd.quantity.toFixed(3)}. Maksimal ${Math.floor(sd.quantity * MAX_UNITS_PER_SUPPLY_UNIT)} unit.`,
          };
        }
      }

      // Sanity check: prevent unrealistic RB-to-FG ratio
      const MAX_UNITS_PER_KG_RB = 100;
      if (input.unitsProduced > totalRbUsedKg * MAX_UNITS_PER_KG_RB) {
        return {
          success: false,
          error: `Jumlah produksi (${input.unitsProduced} unit) terlalu besar untuk ${totalRbUsedKg.toFixed(3)} kg bahan baku. Maksimal ${Math.floor(totalRbUsedKg * MAX_UNITS_PER_KG_RB)} unit.`,
        };
      }

      // 4. Hitung HPP per unit (termasuk labor & overhead + supply)
      const pkgCostPerUnit = supplyPackaging
        ? Number(supplyPackaging.avgCostPerUnit ?? 0) || Number(supplyPackaging.costPerUnit ?? 0)
        : Number(packaging.avgCostPerUnit) || Number(packaging.costPerUnit);
      const pkgCostTotal = pkgCostPerUnit * input.unitsProduced;
      const laborCost = Number(input.laborCost ?? 0);
      const overheadCost = Number(input.overheadAllocated ?? 0);
      const totalCost = totalRbCost + pkgCostTotal + totalSupplyCost + laborCost + overheadCost;
      const hppPerUnit = totalCost / input.unitsProduced;

      // 5. Generate kode
      const batchCode = await generateBatchCode();

      const batch = await tx.productionBatch.create({
        data: {
          tenantId,
          code:              batchCode,
          operationKey:      input.operationKey,
          recipeId:          input.recipeId ?? null,
          outputProductId:   input.outputProductId,
          packagingId:       resolvedPackagingId,
          unitsProduced:     input.unitsProduced,
          totalRbUsedKg:     totalRbUsedKg,
          hppPerUnit:        hppPerUnit,
          laborCost:         laborCost > 0 ? laborCost : undefined,
          overheadAllocated: overheadCost > 0 ? overheadCost : undefined,
          status:            "COMPLETED",
          parentRoastBatchId: resolvedParentRoastBatchId,
          notes:             input.notes?.trim() || null,
          createdById:       userId,
        },
      });

      // RB keluar per komponen
      for (const rb of rbDetails) {
        await appendFefoLedgerOut(tx, {
            tenantId,
            productId:   rb.productId,
            refType:     "PRODUCTION_RB_OUT",
            refId:       batch.id,
            quantityKg:  rb.actualKg,
            notes:       `Produksi: ${batch.code}`,
            createdById: userId,
        });
      }

      // Packaging keluar — canonical via supply stream bila item ter-mapping
      // (stok hanya di-update di InventorySupplyItem, tidak dua model)
      if (supplyPackaging) {
        if (supplyPackaging.trackLot) {
          await appendFefoLedgerOut(tx, {
            tenantId,
            supplyItemId:  supplyPackaging.id,
            refType:       "SUPPLY_PRODUCTION_OUT",
            refId:         batch.id,
            supplyQuantity: input.unitsProduced,
            notes:         `Produksi: ${batch.code}`,
            createdById:   userId,
          });
        } else {
          await appendLedger(tx, {
            data: {
              tenantId,
              supplyItemId:  supplyPackaging.id,
              entryType:     "OUT",
              refType:       "SUPPLY_PRODUCTION_OUT",
              refId:         batch.id,
              supplyQuantity: input.unitsProduced,
              notes:         `Produksi: ${batch.code}`,
              createdById:   userId,
            },
          });
        }
      } else {
        await appendFefoLedgerOut(tx, {
            tenantId,
            packagingId:  input.packagingId!,
            refType:      "PRODUCTION_PKG_OUT",
            refId:        batch.id,
            quantityUnit: input.unitsProduced,
            notes:        `Produksi: ${batch.code}`,
            createdById:  userId,
        });
      }

      // Supply keluar + snapshot
      for (const sd of supplyDetails) {
        if (sd.trackLot) {
          await appendFefoLedgerOut(tx, {
            tenantId,
            supplyItemId:  sd.supplyItemId,
            refType:       "SUPPLY_PRODUCTION_OUT",
            refId:         batch.id,
            supplyQuantity: sd.quantity,
            notes:         `Produksi: ${batch.code}`,
            createdById:   userId,
          });
        } else {
          await appendLedger(tx, {
            data: {
              tenantId,
              supplyItemId:  sd.supplyItemId,
              entryType:     "OUT",
              refType:       "SUPPLY_PRODUCTION_OUT",
              refId:         batch.id,
              supplyQuantity: sd.quantity,
              notes:         `Produksi: ${batch.code}`,
              createdById:   userId,
            },
          });
        }

        await tx.productionSupplyUsage.create({
          data: {
            tenantId,
            productionBatchId: batch.id,
            supplyItemId:      sd.supplyItemId,
            quantity:          sd.quantity,
            unitCostSnapshot:  sd.unitCostSnapshot,
            totalCostSnapshot: sd.totalCostSnapshot,
          },
        });
      }

      // Read current stock BEFORE incrementing (for weighted HPP calculation)
      const currentProduct = await tx.product.findUnique({
        where: { id: input.outputProductId },
        select: { stockUnit: true, lastHpp: true },
      });

      // Finished Goods masuk
      const outputLot = await tx.lot.create({
        data: {
          tenantId,
          productId: input.outputProductId,
          batchCode: `${batch.code}-FG`,
          quantityUnit: input.unitsProduced,
          receivedAt: getCurrentDate(),
          notes: `Hasil produksi ${batch.code}`,
        },
      });
      await createLotPlacementInTx(tx, tenantId, outputLot.id, {
        destinationLocationId: input.destinationLocationId,
        quantityUnit: input.unitsProduced,
      });
      await appendLedger(tx, {
        data: {
          tenantId,
          productId:    input.outputProductId,
          entryType:    "IN",
          refType:      "PRODUCTION_FG_IN",
          refId:        batch.id,
          quantityUnit: input.unitsProduced,
          lotId:        outputLot.id,
          lotNumber:    outputLot.batchCode,
          notes:        `Produksi: ${batch.code}`,
          createdById:  userId,
        },
      });

      // Oldest storefront shortage gets this finished stock first. Paid orders
      // are posted out immediately; unpaid orders receive a time-bound reservation.
      await allocateProducedStockToDemand(tx, {
        tenantId,
        productId: input.outputProductId,
        createdById: userId,
        now: getCurrentDate(),
      });

      // Weighted average: blend current stock cost with new batch cost
      const currentStock = Number(currentProduct?.stockUnit ?? 0);
      const currentAvg = Number(currentProduct?.lastHpp ?? 0);
      const weightedHpp = currentStock > 0
        ? (currentStock * currentAvg + input.unitsProduced * hppPerUnit) / (currentStock + input.unitsProduced)
        : hppPerUnit;

      await tx.product.update({
        where: { id: input.outputProductId },
        data: { lastHpp: weightedHpp },
      });

      await postProductionBatch(
        batch.id,
        totalRbCost,
        pkgCostTotal,
        totalSupplyCost,
        laborCost,
        overheadCost,
        outputProduct.name ?? batchCode,
        { tx, tenantId, userId },
      );

      await recordAudit(tx, {
        tenantId,
        userId,
        action: "CREATE",
        entityType: "ProductionBatch",
        entityId: batch.id,
        after: {
          code: batch.code,
          unitsProduced: batch.unitsProduced,
          totalRbUsedKg: Number(batch.totalRbUsedKg),
          hppPerUnit: Number(batch.hppPerUnit),
        },
        metadata: { operationKey: input.operationKey, componentCount: rbDetails.length },
      });

      try {
        revalidatePath("/produksi");
        revalidatePath("/inventory");
        revalidatePath("/dashboard");
        revalidatePath("/laporan");
        revalidatePath("/penjualan");
      } catch {
        // revalidatePath requires a Next.js request context; ignore in tests/non-HTTP environments
      }
      return { success: true, batchCode };
    }, { isolationLevel: "Serializable", maxWait: 5000, timeout: 30000 });
  } catch (err) {
    console.error("[createProductionBatch]", err);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && input.operationKey) {
      const existing = await (await requireTenantPrisma()).productionBatch.findFirst({
        where: { operationKey: input.operationKey },
        select: { code: true },
      });
      if (existing) return { success: true, batchCode: existing.code };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Terjadi kesalahan sistem.",
    };
  }
}

// =============================================================================
// VOID PRODUCTION BATCH
// =============================================================================

export type VoidResult =
  | { success: true }
  | { success: false; error: string };

export async function voidProductionBatch(
  batchId: string,
  reason: string
): Promise<VoidResult> {
  try {
    await requireRole("OWNER", "MANAGER");
    if (!reason.trim()) {
      return { success: false, error: "Alasan void wajib diisi." };
    }
    const userId = await getSystemUserId();
    const tenantId = await getCurrentTenantId();
    const tenantPrisma = await requireTenantPrisma();

    await tenantPrisma.$transaction(async (tx) => {
      const batch = await tx.productionBatch.findUnique({ where: { id: batchId } });
      if (!batch) throw new Error("Batch tidak ditemukan.");
      if (batch.status === "VOID") throw new Error("Batch sudah di-void.");
      const ledgerEntries = await tx.inventoryLedger.findMany({
        where: {
          refId: batchId,
          refType: { in: ["PRODUCTION_RB_OUT", "PRODUCTION_PKG_OUT", "PRODUCTION_FG_IN", "SUPPLY_PRODUCTION_OUT"] },
        },
      });
      if (ledgerEntries.length === 0) {
        throw new Error("Ledger produksi tidak ditemukan; void dibatalkan untuk menjaga integritas stok.");
      }
      const outputLotIds = ledgerEntries
        .filter((entry) => entry.refType === "PRODUCTION_FG_IN" && entry.lotId)
        .map((entry) => entry.lotId!);
      if (outputLotIds.length > 0) {
        const downstreamCount = await tx.inventoryLedger.count({
          where: { lotId: { in: outputLotIds }, entryType: "OUT", refType: { not: "VOID_REVERSAL" } },
        });
        if (downstreamCount > 0) {
          throw new Error("Barang jadi batch ini sudah dijual atau dipakai. Batalkan transaksi turunannya terlebih dahulu.");
        }
      }

      // Balik setiap ledger entry
      for (const entry of ledgerEntries) {
        const isSupply = entry.refType === "SUPPLY_PRODUCTION_OUT";
        await appendLedger(tx, {
          data: {
            tenantId,
            productId:     isSupply ? undefined : entry.productId,
            packagingId:   isSupply ? undefined : entry.packagingId,
            supplyItemId:  isSupply ? entry.supplyItemId : undefined,
            entryType:     entry.entryType === "IN" ? "OUT" : "IN",
            refType:       "VOID_REVERSAL",
            refId:         batchId,
            quantityKg:    isSupply ? undefined : entry.quantityKg,
            quantityUnit:  isSupply ? undefined : entry.quantityUnit,
            supplyQuantity: isSupply ? entry.supplyQuantity : undefined,
            lotId:         entry.lotId,
            lotNumber:     entry.lotNumber,
            expiryDate:    entry.expiryDate,
            notes:         `VOID reversal: ${batch.code}`,
            createdById:   userId,
          },
        });
        if (entry.lotId) {
          await tx.lot.update({
            where: { id: entry.lotId },
            data: { consumedAt: entry.entryType === "OUT" ? null : getCurrentDate() },
          });
        }
      }

      await tx.productionBatch.update({
        where: { id: batchId },
        data: { status: "VOID", voidReason: reason.trim(), voidAt: getCurrentDate() },
      });
      await postVoidReversal("PRODUCTION", batch.id, reason, { tx, tenantId, userId });
      const previousBatch = await tx.productionBatch.findFirst({
        where: {
          outputProductId: batch.outputProductId,
          status: "COMPLETED",
          id: { not: batch.id },
        },
        orderBy: { producedAt: "desc" },
        select: { hppPerUnit: true },
      });
      await tx.product.update({
        where: { id: batch.outputProductId },
        data: { lastHpp: previousBatch?.hppPerUnit ?? null },
      });

      await recordAudit(tx, {
        tenantId,
        userId,
        action: "VOID",
        entityType: "ProductionBatch",
        entityId: batch.id,
        before: { status: batch.status },
        after: { status: "VOID", reason: reason.trim() },
      });
    }, { isolationLevel: "Serializable" });

    revalidatePath("/produksi");
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    revalidatePath("/laporan");
    revalidatePath("/penjualan");
    return { success: true };
  } catch (err) {
    console.error("[voidProductionBatch]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal melakukan void.",
    };
  }
}
