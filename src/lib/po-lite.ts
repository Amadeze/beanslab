import type { PrismaClient, POStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { appendLedger } from "./stock";
import { postPurchase } from "./posting";

// =============================================================================
// TYPES
// =============================================================================

export type CreatePOInput = {
  supplierId: string;
  expectedDate?: string;
  estimatedShippingCost?: number;
  notes?: string;
  items: Array<{
    productId?: string;
    packagingId?: string;
    quantity: number;
    unitPrice: number;
    reorderPoint?: number;
    currentStock?: number;
  }>;
};

export type UpdatePOInput = {
  id: string;
  supplierId?: string;
  expectedDate?: string;
  estimatedShippingCost?: number;
  notes?: string;
  items?: Array<{
    id?: string; // existing item ID untuk update
    productId?: string;
    packagingId?: string;
    quantity: number;
    unitPrice: number;
    reorderPoint?: number;
    currentStock?: number;
  }>;
};

export type ReceivePOInput = {
  receivedAt: string;
  shippingCost?: number;
  paymentMethod?: "CASH" | "TRANSFER" | "CREDIT";
  dueDate?: string;
  items: Array<{
    poItemId: string;
    receivedQuantity: number;
    notes?: string;
  }>;
};

export type POFilter = {
  status?: POStatus;
  search?: string;
  page?: number;
  limit?: number;
};

export type POListItem = {
  id: string;
  code: string;
  status: POStatus;
  supplierName: string;
  expectedDate: string | null;
  estimatedShippingCost: number;
  totalEstimate: number;
  sentAt: string | null;
  receivedAt: string | null;
  createdAt: string;
  itemCount: number;
  items: Array<{
    productName: string | null;
    packagingName: string | null;
    quantity: number;
  }>;
};

export type PODetail = POListItem & {
  notes: string | null;
  receivedShippingCost: number;
  remainingShippingEstimate: number;
  items: Array<{
    id: string;
    productName: string | null;
    packagingName: string | null;
    quantity: number;
    receivedQuantity: number;
    remainingQuantity: number;
    unitPrice: number;
    totalPrice: number;
    reorderPoint: number | null;
    currentStock: number | null;
  }>;
  purchases: Array<{
    id: string;
    code: string;
    receivedAt: string;
    shippingCost: number;
    totalCost: number;
  }>;
};

// =============================================================================
// PURE FUNCTIONS
// =============================================================================

function calculateTotalEstimate(
  items: Array<{ quantity: number; unitPrice: number }>,
  estimatedShippingCost = 0,
): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    + estimatedShippingCost;
}

export function allocateShippingCost(
  itemCosts: number[],
  shippingCost: number,
): number[] {
  if (itemCosts.length === 0) return [];
  const shippingCents = Math.round(shippingCost * 100);
  if (shippingCents === 0) return itemCosts.map(() => 0);

  const totalItemCost = itemCosts.reduce((sum, cost) => sum + cost, 0);
  const weights = totalItemCost > 0 ? itemCosts : itemCosts.map(() => 1);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let allocatedCents = 0;

  return weights.map((weight, index) => {
    const cents = index === weights.length - 1
      ? shippingCents - allocatedCents
      : Math.floor((shippingCents * weight) / totalWeight);
    allocatedCents += cents;
    return cents / 100;
  });
}

function getStatusLabel(status: POStatus): string {
  const labels: Record<POStatus, string> = {
    DRAFT: "Draft",
    SENT: "Terkirim",
    PARTIAL: "Sebagian Diterima",
    RECEIVED: "Diterima",
    CANCELLED: "Dibatalkan",
  };
  return labels[status];
}

// =============================================================================
// DB FUNCTIONS
// =============================================================================

function getSinceDate(days: number): Date {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return since;
}

function generateSupplierPaymentCode(paidAt: Date): string {
  const prefix = `SPAY-${paidAt.getFullYear()}${String(paidAt.getMonth() + 1).padStart(2, "0")}`;
  return `${prefix}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/**
 * Generate kode PO: PO-YYYYMM-NNN
 */
export async function generatePOCode(prisma: PrismaClient): Promise<string> {
  const now = new Date();
  const prefix = `PO-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const count = await prisma.purchaseOrder.count({
    where: { code: { startsWith: prefix } },
  });
  return `${prefix}-${String(count + 1).padStart(3, "0")}`;
}

/**
 * Create a new Purchase Order (Draft)
 */
export async function createDraftPO(
  prisma: PrismaClient,
  input: CreatePOInput,
  userId: string,
): Promise<{ id: string; code: string }> {
  // Validate supplier
  const supplier = await prisma.supplier.findUnique({
    where: { id: input.supplierId },
    select: { id: true, isActive: true, tenantId: true },
  });
  if (!supplier || !supplier.isActive) {
    throw new Error("Supplier tidak ditemukan atau tidak aktif.");
  }
  const tenantId = supplier.tenantId;

  // Validate items
  if (!input.items || input.items.length === 0) {
    throw new Error("PO harus memiliki minimal 1 item.");
  }

  for (const item of input.items) {
    if (!item.productId && !item.packagingId) {
      throw new Error("Setiap item harus memiliki produk atau kemasan.");
    }
    if (item.quantity <= 0) {
      throw new Error("Quantity harus lebih dari 0.");
    }
    if (item.unitPrice < 0) {
      throw new Error("Harga tidak boleh negatif.");
    }
  }
  const estimatedShippingCost = Number(input.estimatedShippingCost ?? 0);
  if (!Number.isFinite(estimatedShippingCost) || estimatedShippingCost < 0) {
    throw new Error("Estimasi ongkir tidak boleh negatif.");
  }

  // Calculate total estimate
  const totalEstimate = calculateTotalEstimate(input.items, estimatedShippingCost);

  // Create PO + items in transaction. The sequential code may collide under
  // concurrency; retry on the unique constraint with a fresh candidate.
  const MAX_CODE_ATTEMPTS = 5;
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const code = await generatePOCode(prisma);
    try {
      return await prisma.$transaction(async (tx) => {
        const po = await tx.purchaseOrder.create({
          data: {
            tenantId,
            code,
            status: "DRAFT",
            supplierId: input.supplierId,
            expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
            notes: input.notes?.trim() || null,
            estimatedShippingCost,
            totalEstimate,
            createdById: userId,
          },
        });

        await tx.purchaseOrderItem.createMany({
          data: input.items.map((item) => ({
            tenantId,
            purchaseOrderId: po.id,
            productId: item.productId || null,
            packagingId: item.packagingId || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
            reorderPoint: item.reorderPoint ?? null,
            currentStock: item.currentStock ?? null,
          })),
        });

        return { id: po.id, code: po.code };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        attempt + 1 < MAX_CODE_ATTEMPTS
      ) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("PO code allocation failed after retries");
}

/**
 * Update a Draft PO
 */
export async function updateDraftPO(
  prisma: PrismaClient,
  input: UpdatePOInput,
): Promise<void> {
  // Validate PO exists and is Draft
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: input.id },
    select: { id: true, status: true, tenantId: true, estimatedShippingCost: true },
  });

  if (!po) {
    throw new Error("PO tidak ditemukan.");
  }
  const tenantId = po.tenantId;

  if (po.status !== "DRAFT") {
    throw new Error("Hanya PO berstatus Draft yang dapat diedit.");
  }
  const estimatedShippingCost = input.estimatedShippingCost === undefined
    ? Number(po.estimatedShippingCost ?? 0)
    : Number(input.estimatedShippingCost);
  if (!Number.isFinite(estimatedShippingCost) || estimatedShippingCost < 0) {
    throw new Error("Estimasi ongkir tidak boleh negatif.");
  }

  // Update PO + items in transaction
  await prisma.$transaction(async (tx) => {
    // Update PO header
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {};
    if (input.supplierId) updateData.supplierId = input.supplierId;
    if (input.expectedDate !== undefined) {
      updateData.expectedDate = input.expectedDate ? new Date(input.expectedDate) : null;
    }
    if (input.notes !== undefined) updateData.notes = input.notes?.trim() || null;
    if (input.estimatedShippingCost !== undefined) {
      updateData.estimatedShippingCost = estimatedShippingCost;
    }

    if (input.items) {
      // Calculate new total
      updateData.totalEstimate = calculateTotalEstimate(input.items, estimatedShippingCost);

      // Delete existing items
      await tx.purchaseOrderItem.deleteMany({
        where: { purchaseOrderId: input.id },
      });

      // Create new items
      await tx.purchaseOrderItem.createMany({
        data: input.items.map((item) => ({
          tenantId,
          purchaseOrderId: input.id,
          productId: item.productId || null,
          packagingId: item.packagingId || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.quantity * item.unitPrice,
          reorderPoint: item.reorderPoint ?? null,
          currentStock: item.currentStock ?? null,
        })),
      });
    } else if (input.estimatedShippingCost !== undefined) {
      const currentItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: input.id },
        select: { quantity: true, unitPrice: true },
      });
      updateData.totalEstimate = calculateTotalEstimate(
        currentItems.map((item) => ({ quantity: Number(item.quantity), unitPrice: Number(item.unitPrice) })),
        estimatedShippingCost,
      );
    }

    await tx.purchaseOrder.update({
      where: { id: input.id },
      data: updateData,
    });
  });
}

/**
 * Send PO to supplier (DRAFT → SENT)
 */
export async function sendPO(
  prisma: PrismaClient,
  poId: string,
): Promise<void> {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    select: { id: true, status: true },
  });

  if (!po) {
    throw new Error("PO tidak ditemukan.");
  }

  if (po.status !== "DRAFT") {
    throw new Error("Hanya PO berstatus Draft yang dapat dikirim.");
  }

  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: {
      status: "SENT",
      sentAt: new Date(),
    },
  });
}

/**
 * Receive PO items (SENT/PARTIAL → PARTIAL/RECEIVED)
 * Creates Purchase + Ledger entries for each received item
 */
export async function receivePO(
  prisma: PrismaClient,
  poId: string,
  input: ReceivePOInput,
  userId: string,
): Promise<{ purchaseCodes: string[] }> {
  // Validate PO
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    select: {
      id: true,
      code: true,
      tenantId: true,
      status: true,
      supplierId: true,
      supplier: { select: { name: true } },
      items: {
        select: {
          id: true,
          productId: true,
          packagingId: true,
          quantity: true,
          unitPrice: true,
        },
      },
    },
  });

  if (!po) {
    throw new Error("PO tidak ditemukan.");
  }
  const tenantId = po.tenantId;

  if (po.status !== "SENT" && po.status !== "PARTIAL") {
    throw new Error("Hanya PO berstatus Sent atau Partial yang dapat diterima.");
  }

  const shippingCost = Number(input.shippingCost ?? 0);
  if (!Number.isFinite(shippingCost) || shippingCost < 0) {
    throw new Error("Ongkir aktual tidak boleh negatif.");
  }

  // Validate received items
  const poItemMap = new Map(po.items.map((item) => [item.id, item]));
  const seenItemIds = new Set<string>();
  for (const received of input.items) {
    const poItem = poItemMap.get(received.poItemId);
    if (!poItem) {
      throw new Error(`Item PO ${received.poItemId} tidak ditemukan.`);
    }
    if (received.receivedQuantity < 0) {
      throw new Error("Quantity diterima tidak boleh negatif.");
    }
    if (poItem.packagingId && received.receivedQuantity > 0 && !Number.isInteger(received.receivedQuantity)) {
      throw new Error("Quantity kemasan yang diterima harus berupa unit bulat.");
    }
    if (seenItemIds.has(received.poItemId)) {
      throw new Error("Item PO tidak boleh dikirim dua kali dalam satu penerimaan.");
    }
    seenItemIds.add(received.poItemId);
  }

  const positiveReceipts = input.items.filter((item) => item.receivedQuantity > 0);
  if (positiveReceipts.length === 0) {
    throw new Error("Minimal 1 item harus diterima.");
  }
  const shippingAllocations = allocateShippingCost(
    positiveReceipts.map((received) => {
      const item = poItemMap.get(received.poItemId)!;
      return received.receivedQuantity * Number(item.unitPrice);
    }),
    shippingCost,
  );

  // Process each received item
  const purchaseCodes: string[] = [];
  const receivedAt = new Date(input.receivedAt);
  if (Number.isNaN(receivedAt.getTime())) {
    throw new Error("Tanggal penerimaan tidak valid.");
  }
  const paymentMethod = input.paymentMethod ?? "CREDIT";
  const isPaid = paymentMethod === "CASH" || paymentMethod === "TRANSFER";
  const dueDate = isPaid
    ? null
    : input.dueDate
      ? new Date(`${input.dueDate}T23:59:59`)
      : new Date(receivedAt);
  if (dueDate && !input.dueDate) dueDate.setDate(dueDate.getDate() + 14);
  if (dueDate && Number.isNaN(dueDate.getTime())) {
    throw new Error("Tanggal jatuh tempo tidak valid.");
  }

  // The sequential PUR code may collide when two receipts land concurrently;
  // retry the whole transaction (atomic, rolls back) on the unique constraint
  // with a fresh candidate per attempt.
  const MAX_CODE_ATTEMPTS = 5;
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    purchaseCodes.length = 0;
    try {
      await prisma.$transaction(async (tx) => {
        // Load all previously received quantities per item (matched by productId/packagingId)
    const prevPurchases = await tx.purchase.findMany({
      where: { purchaseOrderId: poId },
      select: { productId: true, packagingId: true, weightKg: true, quantityUnits: true },
    });

    for (const [receiptIndex, received] of positiveReceipts.entries()) {
      const poItem = poItemMap.get(received.poItemId)!;
      const isProduct = !!poItem.productId;

      // H12: Prevent over-receipt per item
      const previousForItem = prevPurchases
        .filter((p) =>
          isProduct ? p.productId === poItem.productId : p.packagingId === poItem.packagingId
        )
        .reduce((sum, p) => sum + Number(p.weightKg ?? 0) + (p.quantityUnits ?? 0), 0);
      const remainingForItem = Number(poItem.quantity) - previousForItem;
      if (received.receivedQuantity > remainingForItem) {
        throw new Error(
          `Over-receipt: item ${poItem.id} hanya sisa ${remainingForItem} unit/kg yang bisa diterima.`
        );
      }

      // Generate purchase code
      const purchasePrefix = `PUR-${receivedAt.getFullYear()}${String(receivedAt.getMonth() + 1).padStart(2, "0")}`;
      const purchaseCount = await tx.purchase.count({
        where: { code: { startsWith: purchasePrefix } },
      });
      const purchaseCode = `${purchasePrefix}-${String(purchaseCount + 1).padStart(3, "0")}`;

      // Calculate total cost for this receipt
      const itemCost = received.receivedQuantity * Number(poItem.unitPrice);
      const allocatedShippingCost = shippingAllocations[receiptIndex] ?? 0;
      const totalCost = itemCost + allocatedShippingCost;

      // Create Purchase
      const purchase = await tx.purchase.create({
        data: {
          tenantId,
          code: purchaseCode,
          type: isProduct ? "GREEN_BEAN" : "PACKAGING",
          supplierId: po.supplierId,
          productId: poItem.productId,
          packagingId: poItem.packagingId,
          weightKg: isProduct ? received.receivedQuantity : null,
          quantityUnits: isProduct ? null : Math.round(received.receivedQuantity),
          pricePerUnit: poItem.unitPrice,
          shippingCost: allocatedShippingCost,
          totalCost,
          status: "COMPLETED",
          paymentStatus: isPaid ? "PAID" : "UNPAID",
          paidAmount: isPaid ? totalCost : 0,
          dueDate,
          receivedAt,
          notes: [
            `Dari PO ${po.code}`,
            received.notes?.trim(),
          ].filter(Boolean).join(" · "),
          createdById: userId,
          purchaseOrderId: poId,
        },
      });

      purchaseCodes.push(purchaseCode);

      if (isPaid) {
        await tx.supplierPayment.create({
          data: {
            tenantId,
            code: generateSupplierPaymentCode(receivedAt),
            purchaseId: purchase.id,
            amount: totalCost,
            method: paymentMethod,
            paidAt: receivedAt,
            notes: `Pembayaran penerimaan ${po.code}`,
            createdById: userId,
          },
        });
      }

      const lot = await tx.lot.create({
        data: {
          tenantId,
          productId: poItem.productId,
          packagingId: poItem.packagingId,
          supplierId: po.supplierId,
          purchaseId: purchase.id,
          batchCode: purchaseCode,
          quantityKg: isProduct ? received.receivedQuantity : 0,
          quantityUnit: isProduct ? 0 : Math.round(received.receivedQuantity),
          receivedAt,
          notes: `Penerimaan ${purchaseCode} dari PO ${poId}`,
        },
      });

      // Create ledger entry + update cached stock + avgCostPerKg via appendLedger
      if (isProduct && poItem.productId) {
        await appendLedger(tx, {
          data: {
            tenantId,
            productId: poItem.productId,
            entryType: "IN",
            refType: "PURCHASE_GB",
            refId: purchase.id,
            quantityKg: received.receivedQuantity,
            incomingPrice: totalCost / received.receivedQuantity,
            lotId: lot.id,
            lotNumber: lot.batchCode,
            notes: `PO ${poId} - ${purchaseCode}`,
            createdById: userId,
          },
        });
      } else if (poItem.packagingId) {
        await appendLedger(tx, {
          data: {
            tenantId,
            packagingId: poItem.packagingId,
            entryType: "IN",
            refType: "PURCHASE_PKG",
            refId: purchase.id,
            quantityUnit: Math.round(received.receivedQuantity),
            incomingPrice: totalCost / Math.round(received.receivedQuantity),
            lotId: lot.id,
            lotNumber: lot.batchCode,
            notes: `PO ${poId} - ${purchaseCode}`,
            createdById: userId,
          },
        });
      }

      await postPurchase(
        purchase.id,
        isProduct ? "GREEN_BEAN" : "PACKAGING",
        totalCost,
        isPaid ? totalCost : 0,
        po.supplier.name,
        { tx, tenantId, userId },
      );
    }

    // H11: Determine new PO status per-item (all items fully received → RECEIVED)
    const allItemsFullyReceived = po.items.every((item) => {
      const prevForItem = prevPurchases
        .filter((p) =>
          item.productId ? p.productId === item.productId : p.packagingId === item.packagingId
        )
        .reduce((sum, p) => sum + Number(p.weightKg ?? 0) + (p.quantityUnits ?? 0), 0);
      const receivedNow = input.items
        .filter((r) => r.poItemId === item.id)
        .reduce((sum, r) => sum + r.receivedQuantity, 0);
      return prevForItem + receivedNow >= Number(item.quantity);
    });

    let newStatus: POStatus;
    if (allItemsFullyReceived) {
      newStatus = "RECEIVED";
    } else {
      newStatus = "PARTIAL";
    }

    await tx.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: newStatus,
        receivedAt: newStatus === "RECEIVED" ? receivedAt : undefined,
      },
    });
      }, { maxWait: 15000, timeout: 30000 });
      break;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        attempt + 1 < MAX_CODE_ATTEMPTS
      ) {
        continue;
      }
      throw error;
    }
  }

  return { purchaseCodes };
}

/**
 * Cancel PO (DRAFT/SENT → CANCELLED)
 */
export async function cancelPO(
  prisma: PrismaClient,
  poId: string,
): Promise<void> {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    select: { id: true, status: true },
  });

  if (!po) {
    throw new Error("PO tidak ditemukan.");
  }

  if (po.status === "RECEIVED" || po.status === "CANCELLED") {
    throw new Error("PO yang sudah diterima atau dibatalkan tidak dapat dibatalkan.");
  }

  if (po.status === "PARTIAL") {
    throw new Error("PO yang sudah sebagian diterima tidak dapat dibatalkan. Hubungi supplier untuk retur.");
  }

  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: { status: "CANCELLED" },
  });
}

/**
 * Get PO list with filters
 */
export async function getPOList(
  prisma: PrismaClient,
  filters: POFilter = {},
): Promise<{ items: POListItem[]; total: number }> {
  const { status, search, page = 1, limit = 20 } = filters;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { code: { contains: search, mode: "insensitive" } },
      { supplier: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: { select: { name: true } },
        items: {
          select: {
            id: true,
            quantity: true,
            product: { select: { name: true } },
            packaging: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  return {
    items: items.map((po) => ({
      id: po.id,
      code: po.code,
      status: po.status,
      supplierName: po.supplier.name,
      expectedDate: po.expectedDate?.toISOString() ?? null,
      estimatedShippingCost: Number(po.estimatedShippingCost ?? 0),
      totalEstimate: Number(po.totalEstimate ?? 0),
      sentAt: po.sentAt?.toISOString() ?? null,
      receivedAt: po.receivedAt?.toISOString() ?? null,
      createdAt: po.createdAt.toISOString(),
      itemCount: po.items.length,
      items: po.items.map((item) => ({
        productName: item.product?.name ?? null,
        packagingName: item.packaging?.name ?? null,
        quantity: Number(item.quantity),
      })),
    })),
    total,
  };
}

/**
 * Get PO detail
 */
export async function getPODetail(
  prisma: PrismaClient,
  poId: string,
): Promise<PODetail | null> {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: {
      supplier: { select: { name: true } },
      items: {
        include: {
          product: { select: { name: true } },
          packaging: { select: { name: true } },
        },
      },
      purchases: {
        select: {
          id: true,
          code: true,
          receivedAt: true,
          productId: true,
          packagingId: true,
          weightKg: true,
          quantityUnits: true,
          shippingCost: true,
          totalCost: true,
        },
        orderBy: { receivedAt: "desc" },
      },
    },
  });

  if (!po) return null;

  const receivedShippingCost = po.purchases.reduce(
    (sum, purchase) => sum + Number(purchase.shippingCost),
    0,
  );

  return {
    id: po.id,
    code: po.code,
    status: po.status,
    supplierName: po.supplier.name,
    expectedDate: po.expectedDate?.toISOString() ?? null,
    estimatedShippingCost: Number(po.estimatedShippingCost ?? 0),
    totalEstimate: Number(po.totalEstimate ?? 0),
    sentAt: po.sentAt?.toISOString() ?? null,
    receivedAt: po.receivedAt?.toISOString() ?? null,
    createdAt: po.createdAt.toISOString(),
    itemCount: po.items.length,
    notes: po.notes,
    receivedShippingCost,
    remainingShippingEstimate: Math.max(
      0,
      Number(po.estimatedShippingCost ?? 0) - receivedShippingCost,
    ),
    items: po.items.map((item) => {
      const receivedQuantity = po.purchases
        .filter((purchase) => item.productId
          ? purchase.productId === item.productId
          : purchase.packagingId === item.packagingId)
        .reduce(
          (sum, purchase) => sum + Number(item.productId ? purchase.weightKg ?? 0 : purchase.quantityUnits ?? 0),
          0,
        );
      const quantity = Number(item.quantity);
      return {
        id: item.id,
        productName: item.product?.name ?? null,
        packagingName: item.packaging?.name ?? null,
        quantity,
        receivedQuantity,
        remainingQuantity: Math.max(0, quantity - receivedQuantity),
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        reorderPoint: item.reorderPoint ? Number(item.reorderPoint) : null,
        currentStock: item.currentStock ? Number(item.currentStock) : null,
      };
    }),
    purchases: po.purchases.map((p) => ({
      id: p.id,
      code: p.code,
      receivedAt: p.receivedAt.toISOString(),
      shippingCost: Number(p.shippingCost),
      totalCost: Number(p.totalCost),
    })),
  };
}

/**
 * Get PO summary counts by status
 */
export async function getPOSummary(
  prisma: PrismaClient,
): Promise<{
  draft: number;
  sent: number;
  partial: number;
  received: number;
  cancelled: number;
  total: number;
}> {
  const counts = await prisma.purchaseOrder.groupBy({
    by: ["status"],
    _count: true,
  });

  const summary = {
    draft: 0,
    sent: 0,
    partial: 0,
    received: 0,
    cancelled: 0,
    total: 0,
  };

  for (const count of counts) {
    summary.total += count._count;
    switch (count.status) {
      case "DRAFT":
        summary.draft = count._count;
        break;
      case "SENT":
        summary.sent = count._count;
        break;
      case "PARTIAL":
        summary.partial = count._count;
        break;
      case "RECEIVED":
        summary.received = count._count;
        break;
      case "CANCELLED":
        summary.cancelled = count._count;
        break;
    }
  }

  return summary;
}
