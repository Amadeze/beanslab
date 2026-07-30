"use server";

import { requireRole, requireTenantPrisma, getCurrentTenantId, getSystemUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { recordAudit } from "@/lib/audit";
import { summarizeLotInventory, type LotOperationalStatus } from "@/lib/lot";

// =============================================================================
// TYPES
// =============================================================================

export type LotRow = {
  id: string;
  batchCode: string;
  productName: string | null;
  productCode: string | null;
  packagingName: string | null;
  packagingCode: string | null;
  supplierName: string | null;
  supplierCode: string | null;
  purchaseCode: string | null;
  quantityKg: number;
  quantityUnit: number;
  expiryDate: string | null;
  receivedAt: string;
  consumedAt: string | null;
  notes: string | null;
  status: LotOperationalStatus;
  createdAt: string;
};

export type TraceStep = {
  stage: string;
  label: string;
  code: string | null;
  date: string | null;
  quantity: string | null;
  notes: string | null;
  url: string | null;
};

export type TraceResult = {
  lot: LotRow;
  steps: TraceStep[];
};

export type ExpiryAlert = {
  id: string;
  batchCode: string;
  productName: string | null;
  supplierName: string | null;
  expiryDate: string;
  quantityKg: number;
  daysUntilExpiry: number;
};

export type LotFilters = {
  search?: string;
  productId?: string;
  supplierId?: string;
  status?: LotOperationalStatus;
  page?: number;
  perPage?: number;
};

// =============================================================================
// HELPERS
// =============================================================================

const traceLotGraphSelect = {
  id: true,
  batchCode: true,
  receivedAt: true,
  quantityKg: true,
  quantityUnit: true,
  notes: true,
  inventoryLedgers: {
    select: {
      refId: true,
      refType: true,
      entryType: true,
      quantityKg: true,
      quantityUnit: true,
      createdAt: true,
    },
  },
} satisfies Prisma.LotSelect;

type TraceGraphLot = Prisma.LotGetPayload<{ select: typeof traceLotGraphSelect }>;

// =============================================================================
// SERVER ACTIONS
// =============================================================================

export async function createLot(data: {
  batchCode: string;
  productId?: string;
  packagingId?: string;
  supplierId?: string;
  purchaseId?: string;
  quantityKg: number;
  quantityUnit: number;
  expiryDate?: string;
  receivedAt?: string;
  notes?: string;
}): Promise<{ success: true; lotId: string; batchCode: string } | { success: false; error: string }> {
  try {
    await requireRole("OWNER", "MANAGER", "OPERATOR");
    const tenantId = await getCurrentTenantId();
    const userId = await getSystemUserId();

    if (!data.batchCode?.trim()) {
      return { success: false, error: "Kode batch wajib diisi." };
    }
    if (!Number.isFinite(data.quantityKg) || data.quantityKg < 0) {
      return { success: false, error: "Jumlah kg tidak valid." };
    }
    if (!Number.isFinite(data.quantityUnit) || data.quantityUnit < 0) {
      return { success: false, error: "Jumlah unit tidak valid." };
    }
    if (Boolean(data.productId) === Boolean(data.packagingId)) {
      return { success: false, error: "Lot harus terhubung ke tepat satu produk atau kemasan." };
    }
    if (data.productId && (data.quantityKg <= 0) === (data.quantityUnit <= 0)) {
      return { success: false, error: "Lot produk harus memakai tepat satu satuan yang bernilai positif." };
    }
    if (data.packagingId && (data.quantityUnit <= 0 || data.quantityKg !== 0)) {
      return { success: false, error: "Lot kemasan harus memakai jumlah unit positif dan 0 kg." };
    }

    const tp = await requireTenantPrisma();

    const existing = await tp.lot.findFirst({
      where: { tenantId, batchCode: data.batchCode.trim() },
      select: { id: true },
    });
    if (existing) {
      return { success: false, error: "Kode batch sudah ada untuk tenant ini." };
    }

    const receivedAt = data.receivedAt
      ? new Date(`${data.receivedAt}T00:00:00`)
      : new Date();

    if (isNaN(receivedAt.getTime())) {
      return { success: false, error: "Tanggal penerimaan tidak valid." };
    }

    const expiryDate = data.expiryDate ? new Date(`${data.expiryDate}T00:00:00`) : null;
    if (data.expiryDate && expiryDate && isNaN(expiryDate.getTime())) {
      return { success: false, error: "Tanggal kedaluwarsa tidak valid." };
    }
    if (expiryDate && expiryDate < receivedAt) {
      return { success: false, error: "Tanggal kedaluwarsa tidak boleh sebelum tanggal penerimaan." };
    }

    const lot = await tp.$transaction(async (tx) => {
      const created = await tx.lot.create({
        data: {
          tenantId,
          productId: data.productId ?? null,
          packagingId: data.packagingId ?? null,
          supplierId: data.supplierId ?? null,
          batchCode: data.batchCode.trim(),
          purchaseId: data.purchaseId ?? null,
          quantityKg: data.quantityKg,
          quantityUnit: data.quantityUnit,
          expiryDate,
          receivedAt,
          notes: data.notes ?? null,
        },
      });
      await recordAudit(tx, {
        tenantId,
        userId,
        action: "CREATE",
        entityType: "Lot",
        entityId: created.id,
        after: {
          batchCode: created.batchCode,
          productId: created.productId,
          packagingId: created.packagingId,
          quantityKg: Number(created.quantityKg),
          quantityUnit: Number(created.quantityUnit),
        },
      });
      return created;
    });

    revalidatePath("/inventory/lots");
    revalidatePath("/inventory");

    return { success: true, lotId: lot.id, batchCode: lot.batchCode };
  } catch (err) {
    console.error("[createLot]", err);
    return { success: false, error: err instanceof Error ? err.message : "Terjadi kesalahan." };
  }
}

export async function getLots(filters: LotFilters = {}): Promise<{ lots: LotRow[]; total: number }> {
  try {
    await requireRole("OWNER", "MANAGER", "OPERATOR");
    const tenantId = await getCurrentTenantId();
    const tp = await requireTenantPrisma();
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 50;
    const skip = (page - 1) * perPage;

    const where: Prisma.LotWhereInput = { tenantId };

    if (filters.search?.trim()) {
      where.OR = [
        { batchCode: { contains: filters.search.trim(), mode: "insensitive" } },
      ];
      if (filters.search.trim().length >= 2) {
        where.OR.push(
          { product: { name: { contains: filters.search.trim(), mode: "insensitive" } } },
          { supplier: { name: { contains: filters.search.trim(), mode: "insensitive" } } },
          { purchase: { code: { contains: filters.search.trim(), mode: "insensitive" } } },
        );
      }
    }

    if (filters.productId) {
      where.productId = filters.productId;
    }

    if (filters.supplierId) {
      where.supplierId = filters.supplierId;
    }

    if (filters.status) {
      const now = new Date();
      const horizon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      if (filters.status === "consumed") where.consumedAt = { not: null };
      if (filters.status === "expired") {
        where.consumedAt = null;
        where.expiryDate = { lt: now };
      }
      if (filters.status === "expiring_soon") {
        where.consumedAt = null;
        where.expiryDate = { gte: now, lt: horizon };
      }
      if (filters.status === "ok") {
        where.consumedAt = null;
        where.AND = [{ OR: [{ expiryDate: null }, { expiryDate: { gte: horizon } }] }];
      }
    }

    const [lots, total] = await Promise.all([
      tp.lot.findMany({
        where,
        include: {
          product: { select: { name: true, code: true } },
          packaging: { select: { name: true, code: true } },
          supplier: { select: { name: true, code: true } },
          purchase: { select: { code: true } },
          inventoryLedgers: {
            select: { entryType: true, quantityKg: true, quantityUnit: true },
          },
        },
        orderBy: { receivedAt: "desc" },
        skip,
        take: perPage,
      }),
      tp.lot.count({ where }),
    ]);

    const result: LotRow[] = lots.map((lot) => {
      const inventory = summarizeLotInventory({
        originalKg: lot.quantityKg,
        originalUnit: lot.quantityUnit,
        ledgers: lot.inventoryLedgers,
        expiryDate: lot.expiryDate,
        consumedAt: lot.consumedAt,
      });
      return {
        id: lot.id,
        batchCode: lot.batchCode,
        productName: lot.product?.name ?? null,
        productCode: lot.product?.code ?? null,
        packagingName: lot.packaging?.name ?? null,
        packagingCode: lot.packaging?.code ?? null,
        supplierName: lot.supplier?.name ?? null,
        supplierCode: lot.supplier?.code ?? null,
        purchaseCode: lot.purchase?.code ?? null,
        quantityKg: inventory.remainingKg,
        quantityUnit: inventory.remainingUnit,
        expiryDate: lot.expiryDate?.toISOString() ?? null,
        receivedAt: lot.receivedAt.toISOString(),
        consumedAt: lot.consumedAt?.toISOString() ?? null,
        notes: lot.notes,
        status: inventory.status,
        createdAt: lot.createdAt.toISOString(),
      };
    });

    return { lots: result, total };
  } catch (err) {
    console.error("[getLots]", err);
    return { lots: [], total: 0 };
  }
}

export async function traceLot(lotId: string): Promise<TraceResult | { success: false; error: string }> {
  try {
    await requireRole("OWNER", "MANAGER", "OPERATOR");
    const tenantId = await getCurrentTenantId();
    const tp = await requireTenantPrisma();

    const lot = await tp.lot.findUnique({
      where: { id: lotId, tenantId },
      include: {
        product: { select: { name: true, code: true, type: true } },
        packaging: { select: { name: true, code: true } },
        supplier: { select: { name: true, code: true, phone: true, address: true } },
        purchase: {
          select: {
            code: true,
            type: true,
            weightKg: true,
            quantityUnits: true,
            pricePerUnit: true,
            totalCost: true,
            receivedAt: true,
            status: true,
          },
        },
        inventoryLedgers: {
          orderBy: { createdAt: "asc" },
          include: {
            product: { select: { name: true, code: true } },
            packaging: { select: { name: true, code: true } },
            createdBy: { select: { name: true } },
          },
        },
      },
    });

    if (!lot) {
      return { success: false, error: "Lot tidak ditemukan." };
    }

    // Telusuri lot lain yang berbagi transaksi ledger. Graf ini dapat bergerak
    // maju dan mundur melewati roasting serta produksi tanpa FK buatan.
    const initialGraphLots = await tp.lot.findMany({
      where: { tenantId, id: lot.id },
      select: traceLotGraphSelect,
    });
    const connectedLots = new Map<string, TraceGraphLot>(
      initialGraphLots.map((item) => [item.id, item]),
    );
    let pendingLotIds = [lot.id];

    for (let depth = 0; depth < 6 && pendingLotIds.length > 0; depth += 1) {
      const levelLots = pendingLotIds
        .map((id) => connectedLots.get(id))
        .filter((item): item is TraceGraphLot => Boolean(item));
      const refIds = [...new Set(levelLots.flatMap((item) => (
        item.inventoryLedgers.map((entry) => entry.refId)
      )))];
      if (refIds.length === 0) break;

      const siblingLedgers = await tp.inventoryLedger.findMany({
        where: { tenantId, refId: { in: refIds }, lotId: { not: null } },
        select: { lotId: true },
      });
      const nextIds = [...new Set(siblingLedgers.flatMap((entry) => (
        entry.lotId ? [entry.lotId] : []
      )))].filter((id) => !connectedLots.has(id));
      if (nextIds.length === 0) break;

      const nextLots = await tp.lot.findMany({
        where: { tenantId, id: { in: nextIds } },
        select: traceLotGraphSelect,
      });
      nextLots.forEach((item) => connectedLots.set(item.id, item));
      pendingLotIds = nextLots.map((item) => item.id);
    }

    const lotInventory = summarizeLotInventory({
      originalKg: lot.quantityKg,
      originalUnit: lot.quantityUnit,
      ledgers: lot.inventoryLedgers,
      expiryDate: lot.expiryDate,
      consumedAt: lot.consumedAt,
    });
    const lotRow: LotRow = {
      id: lot.id,
      batchCode: lot.batchCode,
      productName: lot.product?.name ?? null,
      productCode: lot.product?.code ?? null,
      packagingName: lot.packaging?.name ?? null,
      packagingCode: lot.packaging?.code ?? null,
      supplierName: lot.supplier?.name ?? null,
      supplierCode: lot.supplier?.code ?? null,
      purchaseCode: lot.purchase?.code ?? null,
      quantityKg: lotInventory.remainingKg,
      quantityUnit: lotInventory.remainingUnit,
      expiryDate: lot.expiryDate?.toISOString() ?? null,
      receivedAt: lot.receivedAt.toISOString(),
      consumedAt: lot.consumedAt?.toISOString() ?? null,
      notes: lot.notes,
      status: lotInventory.status,
      createdAt: lot.createdAt.toISOString(),
    };

    const steps: TraceStep[] = [];

    steps.push({
      stage: "supplier",
      label: "Supplier",
      code: lot.supplier?.code ?? null,
      date: null,
      quantity: null,
      notes: lot.supplier?.name ?? null,
      url: lot.supplierId ? `/dashboard/master-data?tab=supplier` : null,
    });

    if (lot.purchase) {
      steps.push({
        stage: "purchase",
        label: "Pembelian",
        code: lot.purchase.code,
        date: lot.purchase.receivedAt.toISOString(),
        quantity: lot.purchase.type === "GREEN_BEAN"
          ? `${Number(lot.purchase.weightKg)} kg`
          : `${lot.purchase.quantityUnits} unit`,
        notes: `Total: Rp ${Number(lot.purchase.totalCost).toLocaleString("id-ID")}`,
        url: `/inventory?tab=purchases`,
      });
    }

    const allLedgers = [...connectedLots.values()].flatMap((item) => item.inventoryLedgers);
    const roastIds = [...new Set(allLedgers
      .filter((entry) => entry.refType.startsWith("ROASTING_"))
      .map((entry) => entry.refId))];
    const productionIds = [...new Set(allLedgers
      .filter((entry) => entry.refType.startsWith("PRODUCTION_"))
      .map((entry) => entry.refId))];
    const invoiceIds = [...new Set(allLedgers
      .filter((entry) => entry.refType === "SALE_FG_OUT")
      .map((entry) => entry.refId))];

    const [roasts, productions, invoices] = await Promise.all([
      roastIds.length > 0 ? tp.parentRoastingBatch.findMany({
        where: { tenantId, id: { in: roastIds } },
        select: { id: true, code: true, completedAt: true, targetWeightKg: true, actualOutputKg: true, notes: true },
      }) : [],
      productionIds.length > 0 ? tp.productionBatch.findMany({
        where: { tenantId, id: { in: productionIds } },
        select: { id: true, code: true, createdAt: true, unitsProduced: true, notes: true },
      }) : [],
      invoiceIds.length > 0 ? tp.invoice.findMany({
        where: { tenantId, id: { in: invoiceIds } },
        select: { id: true, code: true, issuedAt: true, customer: { select: { name: true } } },
      }) : [],
    ]);

    for (const connectedLot of connectedLots.values()) {
      steps.push({
        stage: "lot",
        label: connectedLot.id === lot.id ? "Lot ditelusuri" : "Lot terhubung",
        code: connectedLot.batchCode,
        date: connectedLot.receivedAt.toISOString(),
        quantity: Number(connectedLot.quantityKg) > 0
          ? `${Number(connectedLot.quantityKg)} kg`
          : `${Number(connectedLot.quantityUnit)} unit`,
        notes: connectedLot.notes,
        url: `/inventory/lots/${connectedLot.id}`,
      });
    }
    for (const roast of roasts) {
      steps.push({
        stage: "roasting",
        label: "Roasting",
        code: roast.code,
        date: roast.completedAt?.toISOString() ?? null,
        quantity: `${Number(roast.targetWeightKg)} kg → ${Number(roast.actualOutputKg ?? 0)} kg`,
        notes: roast.notes,
        url: `/roasting/batch/${roast.id}`,
      });
    }
    for (const production of productions) {
      steps.push({
        stage: "production",
        label: "Produksi",
        code: production.code,
        date: production.createdAt.toISOString(),
        quantity: `${production.unitsProduced} unit`,
        notes: production.notes,
        url: "/produksi",
      });
    }
    for (const invoice of invoices) {
      steps.push({
        stage: "customer",
        label: "Pelanggan",
        code: invoice.code,
        date: invoice.issuedAt.toISOString(),
        quantity: null,
        notes: invoice.customer.name,
        url: "/penjualan",
      });
    }

    steps.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

    return { lot: lotRow, steps };
  } catch (err) {
    console.error("[traceLot]", err);
    return { success: false, error: err instanceof Error ? err.message : "Terjadi kesalahan." };
  }
}

export async function getExpiryAlerts(daysAhead: number = 30): Promise<ExpiryAlert[]> {
  try {
    await requireRole("OWNER", "MANAGER", "OPERATOR");
    const tenantId = await getCurrentTenantId();
    const tp = await requireTenantPrisma();

    const cutoff = new Date();
    const horizon = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);

    const lots = await tp.lot.findMany({
      where: {
        tenantId,
        consumedAt: null,
        expiryDate: { gte: cutoff, lte: horizon },
      },
      include: {
        product: { select: { name: true, code: true } },
        supplier: { select: { name: true } },
        inventoryLedgers: {
          select: { entryType: true, quantityKg: true, quantityUnit: true },
        },
      },
      orderBy: { expiryDate: "asc" },
    });

    const now = new Date();
    return lots.flatMap((lot) => {
      const inventory = summarizeLotInventory({
        originalKg: lot.quantityKg,
        originalUnit: lot.quantityUnit,
        ledgers: lot.inventoryLedgers,
        expiryDate: lot.expiryDate,
        consumedAt: lot.consumedAt,
        now,
      });
      if (inventory.status === "consumed") return [];
      const daysUntilExpiry = Math.ceil(
        (lot.expiryDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      return [{
        id: lot.id,
        batchCode: lot.batchCode,
        productName: lot.product?.name ?? null,
        supplierName: lot.supplier?.name ?? null,
        expiryDate: lot.expiryDate!.toISOString(),
        quantityKg: inventory.remainingKg,
        daysUntilExpiry,
      }];
    });
  } catch (err) {
    console.error("[getExpiryAlerts]", err);
    return [];
  }
}
