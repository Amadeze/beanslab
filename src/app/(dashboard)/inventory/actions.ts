"use server";

import { appendLedger } from "@/lib/stock";
import { getCurrentTenantId, getSystemUserId, requireRole, requireTenantPrisma } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";
import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import {
  resolvePurchasePaymentFromAmount,
  type PurchasePaymentState,
} from "@/lib/purchase-payments";
import { getBatchReorderSummaries } from "@/lib/reorder";

// =============================================================================
// TYPES — semua Decimal dikonversi ke number agar bisa di-serialize ke client
// =============================================================================

export type ProductStockRow = {
  id: string;
  code: string;
  name: string;
  type: "GREEN_BEAN" | "ROASTED_BEAN";
  origin: string | null;
  roastLevel: string | null;
  stockKg: number;
  latestHppPerKg: number | null;
};

export type PackagingStockRow = {
  id: string;
  code: string;
  name: string;
  weightGrams: number;
  costPerUnit: number;
  stockUnit: number;
};

export type FGStockRow = {
  id: string;
  code: string;
  name: string;
  type: "FINISHED_GOODS";
  stockUnit: number;
  latestHppPerUnit: number | null;
};

export type SupplierOption = {
  id: string;
  code: string;
  name: string;
};

export type GBProductOption = {
  id: string;
  name: string;
  origin: string | null;
};

export type InventoryPageData = {
  gbStocks: ProductStockRow[];
  rbStocks: ProductStockRow[];
  pkgStocks: PackagingStockRow[];
  fgStocks: FGStockRow[];
  ledgerEntries: LedgerHistoryRow[];
  suppliers: SupplierOption[];
  gbProducts: GBProductOption[];
  sampleConsumption: SampleConsumptionSummary;
};

export type SampleConsumptionSummary = {
  rbConsumedKg: number;
  fgConsumedUnits: number;
  pkgConsumedUnits: number;
  totalCost: number;
  sampleCount: number;
};

export type LedgerHistoryRow = {
  id: string;
  createdAt: string;
  itemName: string;
  itemCode: string;
  itemType: "PRODUCT" | "PACKAGING";
  entryType: "IN" | "OUT";
  refType: string;
  refId: string;
  quantity: number;
  unit: "kg" | "unit";
  notes: string | null;
  createdByName: string;
};

export type PurchaseActionInput = {
  operationKey: string;
  supplierId: string;
  receivedAt: string;       // "YYYY-MM-DD"
  productId?: string;       // ID produk GB existing
  productName?: string;     // nama produk baru
  productOrigin?: string;
  weightKg: number;
  totalCost: number;
  shippingCost: number;
  paidAmount?: number;
  paymentMethod?: "CASH" | "TRANSFER" | "QRIS";
  dueDate?: string;
  notes?: string;
  lotNumber?: string;       // nomor lot dari supplier
  bestBeforeDate?: string;  // "YYYY-MM-DD"
};

export type PackagingPurchaseInput = {
  operationKey: string;
  supplierId: string;
  receivedAt: string;
  packagingId: string;
  quantityUnits: number;
  totalCost: number;
  shippingCost: number;
  paidAmount?: number;
  paymentMethod?: "CASH" | "TRANSFER" | "QRIS";
  dueDate?: string;
  notes?: string;
  lotNumber?: string;
  bestBeforeDate?: string;
};

export type ActionResult =
  | { success: true; purchaseCode: string }
  | { success: false; error: string };

// =============================================================================
// HELPERS
// =============================================================================


/** Generate kode Purchase: PUR-YYYYMM-NNN */
function generatePurchaseCode(receivedAt = new Date()): string {
  const prefix = `PUR-${receivedAt.getFullYear()}${String(receivedAt.getMonth() + 1).padStart(2, "0")}`;
  return `${prefix}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/** Generate kode Product untuk Green Bean baru: GB-SLUG */
function generateProductCode(name: string): string {
  const slug = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 12);
  return `GB-${slug || "BARU"}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

// =============================================================================
// QUERIES
// =============================================================================

async function fetchProductStocks(
  type: "GREEN_BEAN" | "ROASTED_BEAN"
): Promise<ProductStockRow[]> {
  const products = await (await requireTenantPrisma()).product.findMany({
    where: { type, isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      origin: true,
      roastLevel: true,
      stockKg: true,
      avgCostPerKg: true,
    },
    orderBy: { name: "asc" },
  });

  return products.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    type: p.type as "GREEN_BEAN" | "ROASTED_BEAN",
    origin: p.origin,
    roastLevel: p.roastLevel,
    stockKg: Number(p.stockKg),
    latestHppPerKg: p.avgCostPerKg ? Number(p.avgCostPerKg) : null,
  }));
}

async function fetchPackagingStocks(): Promise<PackagingStockRow[]> {
  const packagings = await (await requireTenantPrisma()).packaging.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return packagings.map((pkg) => ({
      id: pkg.id,
      code: pkg.code,
      name: pkg.name,
      weightGrams: Number(pkg.weightGrams),
      costPerUnit: Number(pkg.costPerUnit),
      stockUnit: pkg.stockUnit,
    }));
}

function parsePurchaseDueDate(status: PurchasePaymentState, dueDate: string | undefined, receivedAt: Date) {
  if (status === "PAID") return null;
  const parsed = dueDate ? new Date(`${dueDate}T23:59:59`) : new Date(receivedAt);
  if (!dueDate) parsed.setDate(parsed.getDate() + 14);
  if (Number.isNaN(parsed.getTime())) throw new Error("Tanggal jatuh tempo tidak valid.");
  return parsed;
}

function generateSupplierPaymentCode(paidAt: Date) {
  const prefix = `SPAY-${paidAt.getFullYear()}${String(paidAt.getMonth() + 1).padStart(2, "0")}`;
  return `${prefix}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

async function fetchFGStocks(): Promise<FGStockRow[]> {
  const products = await (await requireTenantPrisma()).product.findMany({
    where: { type: "FINISHED_GOODS", isActive: true },
    include: {
      productionBatches: {
        where: { status: "COMPLETED" },
        orderBy: { producedAt: "desc" },
        take: 1,
        select: { hppPerUnit: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return products.map((p) => {
    const latestHppPerUnit = p.productionBatches[0] 
      ? Number(p.productionBatches[0].hppPerUnit) 
      : null;

    return {
      id: p.id,
      code: p.code,
      name: p.name,
      type: "FINISHED_GOODS",
      stockUnit: p.stockUnit,
      latestHppPerUnit,
    };
  });
}

async function fetchLedgerHistory(): Promise<LedgerHistoryRow[]> {
  const entries = await (await requireTenantPrisma()).inventoryLedger.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      createdAt: true,
      entryType: true,
      refType: true,
      refId: true,
      quantityKg: true,
      quantityUnit: true,
      notes: true,
      product: { select: { code: true, name: true } },
      packaging: { select: { code: true, name: true } },
      createdBy: { select: { name: true } },
    },
  });

  return entries.map((entry) => {
    const usesKg = entry.quantityKg !== null;
    return {
      id: entry.id,
      createdAt: entry.createdAt.toISOString(),
      itemName: entry.product?.name ?? entry.packaging?.name ?? "Item dihapus",
      itemCode: entry.product?.code ?? entry.packaging?.code ?? "-",
      itemType: entry.product ? "PRODUCT" : "PACKAGING",
      entryType: entry.entryType,
      refType: entry.refType,
      refId: entry.refId,
      quantity: usesKg ? Number(entry.quantityKg) : Number(entry.quantityUnit ?? 0),
      unit: usesKg ? "kg" : "unit",
      notes: entry.notes,
      createdByName: entry.createdBy.name,
    };
  });
}

// =============================================================================
// PUBLIC SERVER ACTIONS
// =============================================================================

async function fetchSampleConsumption(
  start: Date,
  end: Date,
): Promise<SampleConsumptionSummary> {
  const tp = await requireTenantPrisma();
  const samples = await tp.sampleUsage.findMany({
    where: { status: "COMPLETED", givenAt: { gte: start, lt: end } },
    select: {
      totalCost: true,
      components: {
        select: {
          quantityKg: true,
          quantityUnit: true,
          productId: true,
          packagingId: true,
          product: { select: { type: true } },
        },
      },
    },
  });

  let rbConsumedKg = 0;
  let fgConsumedUnits = 0;
  let pkgConsumedUnits = 0;
  let totalCost = 0;

  for (const sample of samples) {
    totalCost += Number(sample.totalCost);
    for (const comp of sample.components) {
      if (comp.product?.type === "ROASTED_BEAN" && comp.quantityKg) {
        rbConsumedKg += Number(comp.quantityKg);
      } else if (comp.product?.type === "FINISHED_GOODS" && comp.quantityUnit) {
        fgConsumedUnits += comp.quantityUnit;
      } else if (comp.packagingId && comp.quantityUnit) {
        pkgConsumedUnits += comp.quantityUnit;
      }
    }
  }

  return {
    rbConsumedKg,
    fgConsumedUnits,
    pkgConsumedUnits,
    totalCost,
    sampleCount: samples.length,
  };
}

export async function getInventoryPageData(): Promise<InventoryPageData> {
  await requireRole("OWNER", "MANAGER", "OPERATOR");
  const tp = await requireTenantPrisma();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [gbStocks, rbStocks, pkgStocks, fgStocks, ledgerEntries, suppliers, gbProducts, sampleConsumption] =
    await Promise.all([
      fetchProductStocks("GREEN_BEAN"),
      fetchProductStocks("ROASTED_BEAN"),
      fetchPackagingStocks(),
      fetchFGStocks(),
      fetchLedgerHistory(),
      tp.supplier.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true },
        orderBy: { name: "asc" },
      }),
      tp.product.findMany({
        where: { type: "GREEN_BEAN", isActive: true },
        select: { id: true, name: true, origin: true },
        orderBy: { name: "asc" },
      }),
      fetchSampleConsumption(monthStart, now),
    ]);

  return { gbStocks, rbStocks, pkgStocks, fgStocks, ledgerEntries, suppliers, gbProducts, sampleConsumption };
}

// Tambah packaging options ke page data helper
export async function getPackagingOptions() {
  return (await requireTenantPrisma()).packaging.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true, costPerUnit: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Catat Barang Datang (Green Bean).
 *
 * ACID transaction:
 *   1. Find-or-create Product (GREEN_BEAN)
 *   2. Insert Purchase (status = COMPLETED)
 *   3. Insert InventoryLedger (IN, refType = PURCHASE_GB)
 * Pengguna cukup mengirim total nota. Server memisahkan harga barang dan ongkir,
 * menghitung harga per kg, status pembayaran, utang, dan HPP ledger secara atomik.
 */
export async function createGreenBeanPurchase(
  input: PurchaseActionInput
): Promise<ActionResult> {
  try {
    await requireRole("OWNER", "MANAGER", "OPERATOR");
    const userId = await getSystemUserId();
    const tenantId = await getCurrentTenantId();
    if (!input.operationKey || !/^[0-9a-f-]{36}$/i.test(input.operationKey)) {
      return { success: false, error: "Identitas transaksi tidak valid. Buka ulang form lalu coba lagi." };
    }
    if (!Number.isFinite(input.weightKg) || input.weightKg <= 0) {
      return { success: false, error: "Berat Green Bean harus lebih dari 0 kg." };
    }
    if (!Number.isFinite(input.totalCost) || input.totalCost <= 0) {
      return { success: false, error: "Total pembelian harus lebih dari 0." };
    }
    const shippingCost = Number(input.shippingCost ?? 0);
    if (!Number.isFinite(shippingCost) || shippingCost < 0 || shippingCost >= input.totalCost) {
      return { success: false, error: "Ongkos kirim harus lebih kecil dari total pembelian." };
    }

    const tenantPrisma = await requireTenantPrisma();
    const previousAttempt = await tenantPrisma.purchase.findFirst({
      where: { operationKey: input.operationKey },
      select: { code: true },
    });
    if (previousAttempt) return { success: true, purchaseCode: previousAttempt.code };

    const payment = resolvePurchasePaymentFromAmount(input.totalCost, input.paidAmount);
    const receivedAt = new Date(`${input.receivedAt}T00:00:00`);
    if (Number.isNaN(receivedAt.getTime())) {
      return { success: false, error: "Tanggal penerimaan tidak valid." };
    }
    const dueDate = parsePurchaseDueDate(payment.paymentStatus, input.dueDate, receivedAt);
    const purchaseCode = generatePurchaseCode(receivedAt);
    const itemCost = input.totalCost - shippingCost;
    const pricePerKg = itemCost / input.weightKg;

    await tenantPrisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUnique({ where: { id: input.supplierId }, select: { id: true, isActive: true } });
      if (!supplier?.isActive) throw new Error("Supplier tidak ditemukan atau sudah nonaktif.");

      let product = input.productId
        ? await tx.product.findUnique({ where: { id: input.productId } })
        : null;
      if (product && (product.type !== "GREEN_BEAN" || !product.isActive)) {
        throw new Error("Produk bukan Green Bean aktif.");
      }
      if (!product && input.productName?.trim()) {
        const productName = input.productName.trim();
        product = await tx.product.findFirst({
          where: { name: { equals: productName, mode: "insensitive" }, type: "GREEN_BEAN", isActive: true },
        });
        if (!product) {
          product = await tx.product.create({
            data: {
              code: generateProductCode(productName),
              name: productName,
              type: "GREEN_BEAN",
              origin: input.productOrigin?.trim() || null,
            },
          });
        }
      }
      if (!product) throw new Error("Pilih Green Bean atau tulis nama Green Bean baru.");

      const purchase = await tx.purchase.create({
        data: {
          code: purchaseCode,
          operationKey: input.operationKey,
          type: "GREEN_BEAN",
          supplierId: input.supplierId,
          productId: product.id,
          weightKg: input.weightKg,
          pricePerUnit: pricePerKg,
          shippingCost,
          totalCost: input.totalCost,
          status: "COMPLETED",
          paymentStatus: payment.paymentStatus,
          paidAmount: payment.paidAmount,
          dueDate,
          receivedAt,
          lotNumber: input.lotNumber ?? null,
          bestBeforeDate: input.bestBeforeDate ? new Date(`${input.bestBeforeDate}T00:00:00`) : null,
          notes: input.notes ?? null,
          createdById: userId,
        },
      });

      if (payment.paidAmount > 0) {
        await tx.supplierPayment.create({
          data: {
            code: generateSupplierPaymentCode(receivedAt),
            purchaseId: purchase.id,
            amount: payment.paidAmount,
            method: input.paymentMethod ?? "CASH",
            paidAt: receivedAt,
            notes: payment.paymentStatus === "PARTIAL" ? "Uang muka pembelian" : "Pembayaran pembelian",
            createdById: userId,
          },
        });
      }

      await appendLedger(tx, {
        data: {
          productId: product.id,
          entryType: "IN",
          refType: "PURCHASE_GB",
          refId: purchase.id,
          quantityKg: input.weightKg,
          incomingPrice: input.totalCost / input.weightKg,
          lotNumber: input.lotNumber ?? null,
          expiryDate: input.bestBeforeDate ? new Date(`${input.bestBeforeDate}T00:00:00`) : null,
          notes: `Barang datang: ${purchase.code}`,
          createdById: userId,
        },
      });

      await recordAudit(tx, {
        tenantId,
        userId,
        action: "CREATE",
        entityType: "Purchase",
        entityId: purchase.id,
        after: {
          code: purchase.code,
          type: purchase.type,
          totalCost: Number(purchase.totalCost),
          paymentStatus: purchase.paymentStatus,
          paidAmount: Number(purchase.paidAmount),
        },
        metadata: { operationKey: input.operationKey, balance: payment.balance },
      });
    }, { isolationLevel: "Serializable" });

    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    revalidatePath("/keuangan");
    revalidatePath("/laporan");
    return { success: true, purchaseCode };
  } catch (err) {
    console.error("[createGreenBeanPurchase]", err);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && input.operationKey) {
      const existing = await (await requireTenantPrisma()).purchase.findFirst({
        where: { operationKey: input.operationKey },
        select: { code: true },
      });
      if (existing) return { success: true, purchaseCode: existing.code };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Terjadi kesalahan sistem.",
    };
  }
}

// =============================================================================
// CREATE PACKAGING PURCHASE
// =============================================================================

export async function createPackagingPurchase(
  input: PackagingPurchaseInput
): Promise<ActionResult> {
  try {
    await requireRole("OWNER", "MANAGER", "OPERATOR");
    const userId = await getSystemUserId();
    const tenantId = await getCurrentTenantId();
    if (!input.operationKey || !/^[0-9a-f-]{36}$/i.test(input.operationKey)) {
      return { success: false, error: "Identitas transaksi tidak valid. Buka ulang form lalu coba lagi." };
    }
    if (!Number.isInteger(input.quantityUnits) || input.quantityUnits <= 0) {
      return { success: false, error: "Jumlah kemasan harus berupa unit lebih dari 0." };
    }
    if (!Number.isFinite(input.totalCost) || input.totalCost <= 0) {
      return { success: false, error: "Total pembelian harus lebih dari 0." };
    }
    const shippingCost = Number(input.shippingCost ?? 0);
    if (!Number.isFinite(shippingCost) || shippingCost < 0 || shippingCost >= input.totalCost) {
      return { success: false, error: "Ongkos kirim harus lebih kecil dari total pembelian." };
    }

    const tenantPrisma = await requireTenantPrisma();
    const previousAttempt = await tenantPrisma.purchase.findFirst({
      where: { operationKey: input.operationKey },
      select: { code: true },
    });
    if (previousAttempt) return { success: true, purchaseCode: previousAttempt.code };

    const payment = resolvePurchasePaymentFromAmount(input.totalCost, input.paidAmount);
    const receivedAt = new Date(`${input.receivedAt}T00:00:00`);
    if (Number.isNaN(receivedAt.getTime())) {
      return { success: false, error: "Tanggal penerimaan tidak valid." };
    }
    const dueDate = parsePurchaseDueDate(payment.paymentStatus, input.dueDate, receivedAt);
    const purchaseCode = generatePurchaseCode(receivedAt);
    const pricePerUnit = (input.totalCost - shippingCost) / input.quantityUnits;

    await tenantPrisma.$transaction(async (tx) => {
      const [supplier, packaging] = await Promise.all([
        tx.supplier.findUnique({ where: { id: input.supplierId }, select: { id: true, isActive: true } }),
        tx.packaging.findUnique({ where: { id: input.packagingId }, select: { id: true, isActive: true } }),
      ]);
      if (!supplier?.isActive) throw new Error("Supplier tidak ditemukan atau sudah nonaktif.");
      if (!packaging?.isActive) throw new Error("Kemasan tidak ditemukan atau sudah nonaktif.");

      const purchase = await tx.purchase.create({
        data: {
          code:         purchaseCode,
          operationKey: input.operationKey,
          type:         "PACKAGING",
          supplierId:   input.supplierId,
          packagingId:  input.packagingId,
          quantityUnits: input.quantityUnits,
          pricePerUnit,
          shippingCost,
          totalCost: input.totalCost,
          status:       "COMPLETED",
          paymentStatus: payment.paymentStatus,
          paidAmount:   payment.paidAmount,
          dueDate,
          receivedAt,
          lotNumber: input.lotNumber ?? null,
          bestBeforeDate: input.bestBeforeDate ? new Date(`${input.bestBeforeDate}T00:00:00`) : null,
          notes:        input.notes ?? null,
          createdById:  userId,
        },
      });

      if (payment.paidAmount > 0) {
        await tx.supplierPayment.create({
          data: {
            code: generateSupplierPaymentCode(receivedAt),
            purchaseId: purchase.id,
            amount: payment.paidAmount,
            method: input.paymentMethod ?? "CASH",
            paidAt: receivedAt,
            notes: payment.paymentStatus === "PARTIAL" ? "Uang muka pembelian" : "Pembayaran pembelian",
            createdById: userId,
          },
        });
      }

      await appendLedger(tx, {
        data: {
          packagingId:  input.packagingId,
          entryType:    "IN",
          refType:      "PURCHASE_PKG",
          refId:        purchase.id,
          quantityUnit: input.quantityUnits,
          incomingPrice: input.totalCost / input.quantityUnits,
          lotNumber: input.lotNumber ?? null,
          expiryDate: input.bestBeforeDate ? new Date(`${input.bestBeforeDate}T00:00:00`) : null,
          notes:        `Kemasan datang: ${purchase.code}`,
          createdById:  userId,
        },
      });

      await recordAudit(tx, {
        tenantId,
        userId,
        action: "CREATE",
        entityType: "Purchase",
        entityId: purchase.id,
        after: {
          code: purchase.code,
          type: purchase.type,
          totalCost: Number(purchase.totalCost),
          paymentStatus: purchase.paymentStatus,
          paidAmount: Number(purchase.paidAmount),
        },
        metadata: { operationKey: input.operationKey, balance: payment.balance },
      });
    }, { isolationLevel: "Serializable" });

    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    revalidatePath("/keuangan");
    revalidatePath("/laporan");
    return { success: true, purchaseCode };
  } catch (err) {
    console.error("[createPackagingPurchase]", err);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && input.operationKey) {
      const existing = await (await requireTenantPrisma()).purchase.findFirst({
        where: { operationKey: input.operationKey },
        select: { code: true },
      });
      if (existing) return { success: true, purchaseCode: existing.code };
    }
    return { success: false, error: err instanceof Error ? err.message : "Terjadi kesalahan." };
  }
}
// =============================================================================
// CREATE PACKAGING (QUICK ADD)
// =============================================================================

export async function createPackaging(data: {
  code?: string;
  name: string;
  weightGrams: number;
  costPerUnit: number;
}) {
  try {
    await requireRole("OWNER", "MANAGER", "OPERATOR");
    const name = data.name?.trim();
    if (!name) return { success: false as const, error: "Nama kemasan wajib diisi." };
    if (!Number.isFinite(data.weightGrams) || data.weightGrams < 0) {
      return { success: false as const, error: "Berat kemasan tidak valid." };
    }
    if (!Number.isFinite(data.costPerUnit) || data.costPerUnit < 0) {
      return { success: false as const, error: "Harga kemasan tidak valid." };
    }

    const tp = await requireTenantPrisma();
    const duplicate = await tp.packaging.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { code: true, name: true },
    });
    if (duplicate) {
      return { success: false as const, error: `${duplicate.code} · ${duplicate.name} sudah terdaftar.` };
    }

    const code = data.code?.trim().toUpperCase() || `PKG-${randomBytes(3).toString("hex").toUpperCase()}`;
    const newPkg = await tp.packaging.create({
      data: {
        code,
        name,
        weightGrams: data.weightGrams,
        costPerUnit: data.costPerUnit,
        isActive: true,
      },
    });

    // Refresh halaman agar dropdown kemasan otomatis mendapatkan data terbaru
    revalidatePath("/inventory"); 

    return {
      success: true as const,
      packagingId: newPkg.id,
      packaging: {
        id: newPkg.id,
        code: newPkg.code,
        name: newPkg.name,
        costPerUnit: Number(newPkg.costPerUnit),
      },
    };
  } catch (err) {
    console.error("[createPackaging]", err);
    return { 
      success: false as const, 
      error: "Gagal menyimpan kemasan. Pastikan kode kemasan unik dan belum digunakan." 
    };
  }
}
// =============================================================================
// STOCK OPNAME (ADJUSTMENT)
// =============================================================================

export async function adjustStock(input: {
  operationKey?: string;
  targetId: string;
  isPackaging: boolean;
  type: "IN" | "OUT";
  quantity: number;
  notes: string;
}) {
  try {
    await requireRole("OWNER", "MANAGER", "OPERATOR");
    const userId = await getSystemUserId();
    const tenantId = await getCurrentTenantId();
    
    // Validasi input
    if (input.quantity <= 0) {
      throw new Error("Kuantitas penyesuaian harus lebih dari 0");
    }

    const refId = input.operationKey || "OPNAME-" + Date.now();

    if (input.operationKey) {
      const existing = await (await requireTenantPrisma()).inventoryLedger.findFirst({
        where: { refId: input.operationKey, refType: { in: ["ADJUSTMENT_IN", "ADJUSTMENT_OUT"] } },
        select: { id: true },
      });
      if (existing) return { success: true };
    }

    await (await requireTenantPrisma()).$transaction(async (tx) => {
      let qtyKg: number | null = null;
      let qtyUnit: number | null = null;
      const refType: "ADJUSTMENT_IN" | "ADJUSTMENT_OUT" = input.type === "IN" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT";

      if (input.isPackaging) {
        qtyUnit = input.quantity;
      } else {
        const prod = await tx.product.findUnique({ where: { id: input.targetId } });
        if (!prod) throw new Error("Produk tidak ditemukan");
        if (prod.type === "FINISHED_GOODS") {
          qtyUnit = input.quantity;
        } else {
          qtyKg = input.quantity;
        }
      }

      // For IN adjustments, preserve the current moving average
      let incomingPrice: number | undefined;
      if (input.type === "IN") {
        if (input.isPackaging) {
          const pkg = await tx.packaging.findUnique({
            where: { id: input.targetId },
            select: { avgCostPerUnit: true },
          });
          incomingPrice = Number(pkg?.avgCostPerUnit ?? 0);
        } else {
          const prod = await tx.product.findUnique({
            where: { id: input.targetId },
            select: { avgCostPerKg: true },
          });
          incomingPrice = Number(prod?.avgCostPerKg ?? 0);
        }
      }

      await appendLedger(tx, {
        data: {
          productId:     input.isPackaging ? null : input.targetId,
          packagingId:   input.isPackaging ? input.targetId : null,
          entryType:     input.type,
          refType,
          refId,
          quantityKg:    qtyKg,
          quantityUnit:  qtyUnit,
          incomingPrice: incomingPrice,
          notes:         input.notes || "Penyesuaian stok fisik (Opname)",
          createdById:   userId,
        }
      });

      await recordAudit(tx, {
        tenantId,
        userId,
        action: "ADJUST",
        entityType: input.isPackaging ? "PackagingStock" : "ProductStock",
        entityId: input.targetId,
        metadata: {
          direction: input.type,
          quantity: input.quantity,
          notes: input.notes,
        },
      });
    }, { isolationLevel: "Serializable" });

    revalidatePath("/inventory");
    return { success: true };
  } catch (err) {
    console.error("[adjustStock]", err);
    return { success: false, error: err instanceof Error ? err.message : "Terjadi kesalahan." };
  }
}

/**
 * Get reorder alert data for all products and packaging
 */
export async function getReorderAlertData() {
  const tp = await requireTenantPrisma();
  return getBatchReorderSummaries(tp);
}
