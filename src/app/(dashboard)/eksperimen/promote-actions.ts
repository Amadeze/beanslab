"use server";

import { revalidatePath } from "next/cache";
import { getCurrentTenantId, getSystemUserId, requireRole, requireTenantPrisma } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { getCurrentDate } from "@/lib/date-utils";
import { appendFefoLedgerOut, appendLedger } from "@/lib/stock";
import { createLotPlacementInTx } from "@/lib/storage-location";
import { postJournalEntry } from "@/lib/posting";
import { Prisma } from "@prisma/client";
import { z } from "zod";

// =============================================================================
// TYPES
// =============================================================================

export type ExperimentalProductionRow = {
  id: string;
  code: string;
  name: string;
  outputProductId: string;
  outputProductName: string;
  inputKg: number;
  outputKg: number;
  hppPerUnit: number;
  status: string;
  createdAt: string;
  notes: string | null;
};

export type PromoteToCatalogInput = {
  experimentalProductionId: string;
  code: string;
  name: string;
  category?: string;
  price?: number;
  priceSilver?: number;
  priceGold?: number;
  netWeightGrams?: number;
  packagingSupplyItemId: string;
  notes?: string;
};

const PromoteToCatalogSchema = z.object({
  experimentalProductionId: z.string().min(1),
  code: z.string().min(1, "SKU wajib diisi"),
  name: z.string().min(2, "Nama minimal 2 karakter"),
  category: z.string().optional(),
  price: z.number().nonnegative().optional(),
  priceSilver: z.number().nonnegative().optional(),
  priceGold: z.number().nonnegative().optional(),
  netWeightGrams: z.number().nonnegative().optional(),
  packagingSupplyItemId: z.string().min(1, "Kemasan wajib dipilih"),
  notes: z.string().optional(),
});

export type PromoteActionResult =
  | { success: true; productCode: string }
  | { success: false; error: string };

// =============================================================================
// PUBLIC SERVER ACTIONS
// =============================================================================

export async function promoteExperimentalToCatalog(
  input: PromoteToCatalogInput
): Promise<PromoteActionResult> {
  try {
    await requireRole("OWNER", "MANAGER");
    const parsed = PromoteToCatalogSchema.parse(input);
    const userId = await getSystemUserId();
    const tenantId = await getCurrentTenantId();
    const tenantPrisma = await requireTenantPrisma();

    const batch = await tenantPrisma.experimentalProduction.findFirst({
      where: { id: parsed.experimentalProductionId, tenantId },
      include: {
        outputProduct: { select: { id: true, code: true, stockKg: true, avgCostPerKg: true } },
        components: { select: { productId: true, supplyItemId: true, quantityKg: true, supplyQuantity: true } },
      },
    });
    if (!batch) {
      return { success: false, error: "Batch eksperimental tidak ditemukan." };
    }
    if (batch.status === "VOID") {
      return { success: false, error: "Batch yang sudah dibatalkan tidak dapat dipromosikan." };
    }

    const codeExists = await tenantPrisma.product.findFirst({
      where: { tenantId, code: parsed.code, id: { not: batch.outputProduct.id } },
    });
    if (codeExists) {
      return { success: false, error: `Kode/SKU "${parsed.code}" sudah digunakan oleh produk lain.` };
    }

    const netWeightGrams = Number(parsed.netWeightGrams ?? 0);
    if (netWeightGrams <= 0) return { success: false, error: "Net weight wajib lebih dari 0 gram agar stok kg dapat dikonversi ke unit." };

    await tenantPrisma.$transaction(async (tx) => {
      const packagingSupply = await tx.inventorySupplyItem.findUnique({
        where: { id: parsed.packagingSupplyItemId },
        include: { packaging: { select: { id: true } } },
      });
      if (!packagingSupply || packagingSupply.tenantId !== tenantId || !packagingSupply.isActive || packagingSupply.category !== "PACKAGING" || !packagingSupply.packaging) {
        throw new Error("Kemasan tidak valid atau belum terhubung ke adapter kemasan.");
      }

      const current = await tx.product.findFirst({
        where: { id: batch.outputProductId, tenantId },
        select: { id: true, code: true, stockKg: true, avgCostPerKg: true },
      });
      if (!current || Number(current.stockKg) <= 0) throw new Error("Tidak ada stok eksperimental kg yang dapat dipromosikan.");
      const rawUnits = Number(current.stockKg) * 1000 / netWeightGrams;
      const units = Math.round(rawUnits);
      if (units < 1 || Math.abs(rawUnits - units) > 0.000001) {
        throw new Error("Stok hasil eksperimen harus merupakan kelipatan tepat dari net weight kemasan.");
      }
      if (Number(packagingSupply.stockQuantity) < units) throw new Error(`Stok kemasan tidak cukup. Tersedia ${Number(packagingSupply.stockQuantity)}, dibutuhkan ${units}.`);

      const downstream = await tx.inventoryLedger.count({
        where: { tenantId, productId: current.id, entryType: "OUT", refType: { not: "EXPERIMENTAL_COMPONENT_OUT" } },
      });
      if (downstream > 0) throw new Error("Stok eksperimen sudah dipakai di proses lain dan tidak dapat dikonversi otomatis.");

      await appendFefoLedgerOut(tx, { tenantId, productId: current.id, refType: "EXPERIMENTAL_COMPONENT_OUT", refId: batch.id, quantityKg: Number(current.stockKg), notes: `Konversi katalog: ${parsed.code}`, createdById: userId });
      await appendFefoLedgerOut(tx, { tenantId, supplyItemId: packagingSupply.id, refType: "SUPPLY_PRODUCTION_OUT", refId: batch.id, supplyQuantity: units, notes: `Kemasan promosi katalog: ${parsed.code}`, createdById: userId });

      await tx.product.update({
        where: { id: current.id },
        data: { code: parsed.code, name: parsed.name, category: parsed.category ?? null, price: parsed.price ?? 0, priceSilver: parsed.priceSilver ?? 0, priceGold: parsed.priceGold ?? 0, netWeightGrams, isActive: true },
      });
      const outputLot = await tx.lot.create({ data: { tenantId, productId: current.id, batchCode: `${batch.code}-CAT`, quantityUnit: units, receivedAt: getCurrentDate(), notes: `Konversi katalog dari ${batch.code}` } });
      await createLotPlacementInTx(tx, tenantId, outputLot.id, { quantityUnit: units });
      await appendLedger(tx, { data: { tenantId, productId: current.id, entryType: "IN", refType: "EXPERIMENTAL_FG_IN", refId: batch.id, quantityUnit: units, lotId: outputLot.id, lotNumber: outputLot.batchCode, notes: `Konversi katalog: ${parsed.code}`, createdById: userId } });

      const coffeeCost = Number(current.avgCostPerKg ?? 0) * Number(current.stockKg);
      const packagingCost = Number(packagingSupply.avgCostPerUnit ?? packagingSupply.costPerUnit) * units;
      await tx.product.update({ where: { id: current.id }, data: { lastHpp: (coffeeCost + packagingCost) / units } });
      if (packagingCost > 0) await postJournalEntry({ date: getCurrentDate(), description: `Kemasan promosi katalog: ${parsed.name}`, reference: `${batch.id}:promotion`, refType: "EXPERIMENTAL", lines: [{ accountCode: "1-1220", debit: packagingCost, credit: 0 }, { accountCode: "1-1230", debit: 0, credit: packagingCost }] }, { tx, tenantId, userId });

      const coffeeComponents = new Map<string, number>();
      const supplyComponents = new Map<string, number>();
      for (const component of batch.components) {
        if (component.productId && component.quantityKg) coffeeComponents.set(component.productId, (coffeeComponents.get(component.productId) ?? 0) + Number(component.quantityKg));
        if (component.supplyItemId && component.supplyQuantity) supplyComponents.set(component.supplyItemId, (supplyComponents.get(component.supplyItemId) ?? 0) + Number(component.supplyQuantity));
      }
      const totalCoffeeKg = [...coffeeComponents.values()].reduce((sum, quantity) => sum + quantity, 0);
      const recipe = await tx.recipe.create({ data: { tenantId, code: `RCP-${parsed.code}`, name: `${parsed.name} — formula eksperimen`, productId: current.id, packagingId: packagingSupply.packaging.id, outputGrams: netWeightGrams, notes: parsed.notes?.trim() || `Dibuat dari ${batch.code}`, items: { create: [...coffeeComponents].map(([productId, quantity]) => ({ tenantId, productId, ratioPercent: totalCoffeeKg > 0 ? quantity / totalCoffeeKg * 100 : 0, gramsPerUnit: totalCoffeeKg > 0 ? netWeightGrams * quantity / totalCoffeeKg : 0 })) }, supplyItems: { create: [{ tenantId, supplyItemId: packagingSupply.id, quantityPerUnit: 1 }, ...[...supplyComponents].filter(([id]) => id !== packagingSupply.id).map(([supplyItemId, quantity]) => ({ tenantId, supplyItemId, quantityPerUnit: quantity / units }))] } } });
      await tx.experimentalProduction.update({ where: { id: batch.id }, data: { notes: `${batch.notes ?? ""}\n[PROMOTED: ${parsed.code}; recipe ${recipe.code}]`.trim() } });
    }, { isolationLevel: "Serializable" });

    await recordAudit(tenantPrisma, {
      tenantId,
      userId,
      action: "PROMOTE",
      entityType: "ExperimentalProduction",
      entityId: batch.id,
      before: { productCode: batch.outputProduct.code, productName: batch.name },
      after: {
        productCode: parsed.code,
        productName: parsed.name,
        category: parsed.category,
        price: parsed.price,
      },
      metadata: { promotedFrom: "experimental", packagingSupplyItemId: parsed.packagingSupplyItemId },
    });

    revalidatePath("/eksperimen");
    revalidatePath("/katalog");
    revalidatePath("/produksi");
    return { success: true, productCode: parsed.code };
  } catch (err) {
    console.error("[promoteExperimentalToCatalog]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal mempromosikan produk.",
    };
  }
}
