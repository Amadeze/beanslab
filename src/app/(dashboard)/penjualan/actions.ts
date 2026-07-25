"use server";
import { getCurrentTenantId, requireFeature, requireRole, requireTenantPrisma, getSystemUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { appendLedger } from "@/lib/stock";
import { recordAudit } from "@/lib/audit";
import { decryptCredential } from "@/lib/credentials";
import { z } from "zod";
import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { findDuplicateSaleProductIds, resolveSalePrice } from "@/lib/sale-intent";
import { calculateTax } from "@/lib/tax";

// =============================================================================
// TYPES
// =============================================================================

export type CustomerOption = {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  tier: "RETAIL" | "WHOLESALE_SILVER" | "WHOLESALE_GOLD";
};

export type FGStockOption = {
  id: string;
  code: string;
  name: string;
  price: number;
  priceSilver: number;
  priceGold: number;
  stockUnit: number;
  lastHppPerUnit: number | null;
};

export type InvoiceItemInput = {
  productId: string;
  quantity: number;
  discount: number; // per unit
};

export type CreateInvoiceInput = {
  operationKey: string;
  customerId: string;
  items: InvoiceItemInput[];
  invoiceDiscount: number;
  tax: number;
  taxType?: "PPN" | "PPH_21" | "PPH_23" | "PPH_4_2" | "NONE";
  customTaxRate?: number;
  pphType?: string;
  status: "PAID" | "ISSUED";
  paymentMethod?: "CASH" | "TRANSFER" | "QRIS" | "CREDIT";
  dueDate?: string; // YYYY-MM-DD
  notes?: string;
};

export type SalesActionResult =
  | { success: true; invoiceCode: string; invoiceId: string }
  | { success: false; error: string };

export type InvoiceRow = {
  id: string;
  code: string;
  customerName: string;
  itemCount: number;
  grandTotal: number;
  paidAmount: number;
  balance: number;
  status: string;
  issuedAt: string;
  dueDate: string | null;
  shippingMethod: string | null;
  shippingAddress: string | null;
  courierName: string | null;
  trackingNumber: string | null;
  shippingCost: number;
};

export type SalesPageData = {
  invoices: InvoiceRow[];
  customers: CustomerOption[];
  fgOptions: FGStockOption[];
};

export type CashierPageData = Pick<SalesPageData, "customers" | "fgOptions">;

// ── Print ──

export type InvoicePrintData = {
  code: string;
  issuedAt: string;
  dueDate: string | null;
  status: string;
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
  items: {
    productName: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    subtotal: number;
    hpp: number;
    margin: number;
  }[];
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paidAmount: number;
  balance: number;
  payments: {
    code: string;
    amount: number;
    method: string;
    paidAt: string;
  }[];
  notes: string | null;
};

const CreateInvoiceSchema = z.object({
  operationKey: z.string().uuid(),
  customerId: z.string().min(1),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().positive().max(100_000),
    discount: z.number().nonnegative(),
  })).min(1).max(100),
  invoiceDiscount: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  taxType: z.enum(["PPN", "PPH_21", "PPH_23", "PPH_4_2", "NONE"]).optional(),
  customTaxRate: z.number().optional(),
  pphType: z.string().optional(),
  status: z.enum(["PAID", "ISSUED"]),
  paymentMethod: z.enum(["CASH", "TRANSFER", "QRIS", "CREDIT"]).optional(),
  dueDate: z.string().optional(),
  notes: z.string().max(2_000).optional(),
});

// =============================================================================
// PAGE DATA
// =============================================================================

export async function getSalesPageData(): Promise<SalesPageData> {
  await requireRole("OWNER", "MANAGER", "CASHIER");
  const tp = await requireTenantPrisma();
  const [invoicesRaw, customers, fgProducts] = await Promise.all([
    tp.invoice.findMany({
      include: {
        customer: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { issuedAt: "desc" },
      take: 200,
    }),
    tp.customer.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, phone: true, tier: true },
    }),
    tp.product.findMany({
      where: { type: "FINISHED_GOODS", isActive: true },
      orderBy: { name: "asc" },
      select: { 
        id: true, 
        code: true, 
        name: true, 
        price: true, 
        priceSilver: true, 
        priceGold: true,
        stockUnit: true,
        lastHpp: true
      },
    }),
  ]);

  const fgOptions = fgProducts.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    price: Number(p.price) || 0,
    priceSilver: Number(p.priceSilver) || 0,
    priceGold: Number(p.priceGold) || 0,
    stockUnit: p.stockUnit || 0,
    lastHppPerUnit: p.lastHpp ? Number(p.lastHpp) : null,
  }));

  const invoices: InvoiceRow[] = invoicesRaw.map((inv: any) => {
    const grand = Number(inv.grandTotal);
    const paid = Number(inv.paidAmount);
    return {
      id: inv.id,
      code: inv.code,
      customerName: inv.customer.name,
      itemCount: inv._count.items,
      grandTotal: grand,
      paidAmount: paid,
      balance: grand - paid,
      status: inv.status,
      issuedAt: inv.issuedAt.toISOString(),
      dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
      shippingMethod: inv.shippingMethod,
      shippingAddress: inv.shippingAddress,
      courierName: inv.courierName,
      trackingNumber: inv.trackingNumber,
      shippingCost: Number(inv.shippingCost || 0),
    };
  });

  return { invoices, customers: customers as CustomerOption[], fgOptions };
}

export async function getCashierPageData(): Promise<CashierPageData> {
  await requireRole("OWNER", "MANAGER", "CASHIER");
  const tp = await requireTenantPrisma();
  const [customers, fgProducts] = await Promise.all([
    tp.customer.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, phone: true, tier: true },
    }),
    tp.product.findMany({
      where: { type: "FINISHED_GOODS", isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        price: true,
        priceSilver: true,
        priceGold: true,
        stockUnit: true,
        lastHpp: true,
      },
    }),
  ]);

  return {
    customers: customers as CustomerOption[],
    fgOptions: fgProducts.map((product) => ({
      id: product.id,
      code: product.code,
      name: product.name,
      price: Number(product.price) || 0,
      priceSilver: Number(product.priceSilver) || 0,
      priceGold: Number(product.priceGold) || 0,
      stockUnit: product.stockUnit || 0,
      lastHppPerUnit: product.lastHpp ? Number(product.lastHpp) : null,
    })),
  };
}

// =============================================================================
// CREATE INVOICE — ACID TRANSACTION
// =============================================================================

export async function createInvoice(input: CreateInvoiceInput): Promise<SalesActionResult> {
  try {
    await requireRole("OWNER", "MANAGER", "CASHIER");
    const parsed = CreateInvoiceSchema.parse(input);
    if (parsed.status === "PAID" && !parsed.paymentMethod) {
      return { success: false, error: "Metode pembayaran wajib dipilih untuk nota lunas." };
    }
    // ── System user ──
    const userId = await getSystemUserId();
    const tenantId = await getCurrentTenantId();
    const tenantPrisma = await requireTenantPrisma();

    const previousAttempt = await tenantPrisma.invoice.findFirst({
      where: { operationKey: parsed.operationKey },
      select: { id: true, code: true },
    });
    if (previousAttempt) {
      return { success: true, invoiceCode: previousAttempt.code, invoiceId: previousAttempt.id };
    }

    const duplicateProductIds = findDuplicateSaleProductIds(parsed.items);
    if (duplicateProductIds.length > 0) {
      return { success: false, error: "Produk yang sama tidak boleh ditambahkan dua kali. Ubah jumlah pada baris yang sudah ada." };
    }

    // ── Validate stock for every item ──
    const [customer, products] = await Promise.all([
      tenantPrisma.customer.findUnique({
        where: { id: parsed.customerId },
        select: { id: true, tier: true },
      }),
      tenantPrisma.product.findMany({
        where: {
          id: { in: parsed.items.map((item) => item.productId) },
          type: "FINISHED_GOODS",
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          price: true,
          priceSilver: true,
          priceGold: true,
          stockUnit: true,
          lastHpp: true,
          productionBatches: {
            where: { status: "COMPLETED" },
            orderBy: { producedAt: "desc" },
            take: 1,
            select: { hppPerUnit: true },
          },
        },
      }),
    ]);
    if (!customer) {
      return { success: false, error: "Customer tidak ditemukan." };
    }
    const productMap = new Map(products.map((product) => [product.id, product]));

    for (const item of parsed.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return { success: false, error: "Salah satu produk tidak valid atau sudah nonaktif." };
      }
      if (product.stockUnit < item.quantity) {
        return {
          success: false,
          error: `Stok "${product.name}" tidak cukup. Tersedia: ${product.stockUnit} unit, dibutuhkan: ${item.quantity} unit.`,
        };
      }
    }

    // ── HPP snapshot per product ──
    // ── Generate invoice code ──
    const now = getCurrentDate();
    const prefix = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const randStr = randomBytes(4).toString("hex").toUpperCase();
    const invoiceCode = `${prefix}-${randStr}`;

    // ── Compute totals ──
    const enrichedItems = parsed.items.map((item) => {
      const product = productMap.get(item.productId)!;
      const unitPrice = resolveSalePrice({
        price: Number(product.price),
        priceSilver: Number(product.priceSilver),
        priceGold: Number(product.priceGold),
      }, customer.tier);
      if (item.discount > unitPrice) {
        throw new Error(`Diskon per unit untuk "${product.name}" melebihi harga jual.`);
      }
      const hpp = Number(product.lastHpp ?? product.productionBatches[0]?.hppPerUnit ?? 0);
      const effectivePrice = unitPrice - item.discount;
      const subtotal = effectivePrice * item.quantity;
      return { ...item, unitPrice, hpp, subtotal };
    });
    const subtotal = enrichedItems.reduce((s, i) => s + i.subtotal, 0);
    if (parsed.invoiceDiscount > subtotal) {
      return { success: false, error: "Diskon invoice tidak boleh melebihi subtotal." };
    }
    const taxResult = calculateTax(
      subtotal,
      parsed.invoiceDiscount,
      parsed.taxType || "NONE",
      parsed.customTaxRate,
      parsed.pphType
    );

    const grandTotal = subtotal - parsed.invoiceDiscount + taxResult.taxAmount;
    if (grandTotal <= 0) {
      return { success: false, error: "Total invoice harus lebih dari 0." };
    }

    // ── ACID transaction ──
    const invoice = await tenantPrisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          code: invoiceCode,
          operationKey: parsed.operationKey,
          customerId: parsed.customerId,
          subtotal,
          discount: parsed.invoiceDiscount,
          tax: taxResult.taxAmount,
          taxType: taxResult.taxType as any,
          taxRate: taxResult.taxRate,
          taxableAmount: taxResult.taxableAmount,
          pphType: taxResult.pphType,
          pphWithholding: taxResult.pphWithholding,
          grandTotal,
          paidAmount: parsed.status === "PAID" ? grandTotal : 0,
          status: parsed.status === "PAID" ? "PAID" : "ISSUED",
          issuedAt: now,
          dueDate: parsed.dueDate ? new Date(`${parsed.dueDate}T00:00:00`) : null,
          notes: parsed.notes,
          createdById: userId,
        },
      });

      // Line items (immutable after insert)
      for (const item of enrichedItems) {
        await tx.invoiceItem.create({
          data: {
            invoiceId: inv.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            subtotal: item.subtotal,
            hpp: item.hpp,
          },
        });
      }

      // InventoryLedger OUT per item
      for (const item of enrichedItems) {
        await appendLedger(tx, {
          data: {
            productId: item.productId,
            entryType: "OUT",
            refType: "SALE_FG_OUT",
            refId: inv.id,
            quantityUnit: item.quantity,
            notes: `Penjualan ${invoiceCode}`,
            createdById: userId,
          },
        });
      }

      // Payment record if PAID
      if (parsed.status === "PAID" && parsed.paymentMethod) {
        const payPrefix = `PAY-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
        const payCode = `${payPrefix}-${randomBytes(4).toString("hex").toUpperCase()}`;

        await tx.payment.create({
          data: {
            code: payCode,
            invoiceId: inv.id,
            amount: grandTotal,
            method: parsed.paymentMethod,
            paidAt: now,
            notes: "Lunas saat nota diterbitkan",
            createdById: userId,
          },
        });
      }

      await recordAudit(tx, {
        tenantId,
        userId,
        action: "CREATE",
        entityType: "Invoice",
        entityId: inv.id,
        after: {
          code: inv.code,
          status: inv.status,
          grandTotal: Number(inv.grandTotal),
        },
        metadata: { itemCount: enrichedItems.length, operationKey: parsed.operationKey },
      });

      return inv;
    });

    revalidatePath("/penjualan");
    revalidatePath("/kasir");
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    revalidatePath("/keuangan");
    revalidatePath("/laporan");

    return { success: true, invoiceCode, invoiceId: invoice.id };
  } catch (err) {
    console.error("[createInvoice]", err);
    if (
      err instanceof Prisma.PrismaClientKnownRequestError
      && err.code === "P2002"
      && input.operationKey
    ) {
      const existing = await (await requireTenantPrisma()).invoice.findFirst({
        where: { operationKey: input.operationKey },
        select: { id: true, code: true },
      });
      if (existing) return { success: true, invoiceCode: existing.code, invoiceId: existing.id };
    }
    return {
      success: false,
      error: err instanceof z.ZodError
        ? "Data nota tidak valid."
        : err instanceof Error
          ? err.message
          : "Gagal menyimpan nota. Coba lagi.",
    };
  }
}

// =============================================================================
// GET INVOICE FOR PRINT
// =============================================================================

export async function getInvoiceForPrint(id: string): Promise<InvoicePrintData | null> {
  const inv = await (await requireTenantPrisma()).invoice.findUnique({
    where: { id },
    include: {
      customer: { select: { name: true, phone: true, address: true } },
      items: {
        include: { product: { select: { name: true, code: true } } },
        orderBy: { id: "asc" },
      },
      payments: { orderBy: { paidAt: "asc" } },
    },
  });

  if (!inv) return null;

  const grandTotal = Number(inv.grandTotal);
  const paidAmount = Number(inv.paidAmount);

  return {
    code: inv.code,
    issuedAt: inv.issuedAt.toISOString(),
    dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
    status: inv.status,
    customerName: inv.customer.name,
    customerPhone: inv.customer.phone,
    customerAddress: inv.customer.address,
    items: inv.items.map((item) => {
      const unitPrice = Number(item.unitPrice);
      const disc = Number(item.discount);
      const hpp = Number(item.hpp);
      const subtotal = Number(item.subtotal);
      const margin = (unitPrice - disc - hpp) * item.quantity;
      return {
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice,
        discount: disc,
        subtotal,
        hpp,
        margin,
      };
    }),
    subtotal: Number(inv.subtotal),
    discount: Number(inv.discount),
    tax: Number(inv.tax),
    grandTotal,
    paidAmount,
    balance: grandTotal - paidAmount,
    payments: inv.payments.map((p) => ({
      code: p.code,
      amount: Number(p.amount),
      method: p.method,
      paidAt: p.paidAt.toISOString(),
    })),
    notes: inv.notes,
  };
}

// =============================================================================
// GET INVOICE FOR RETURN (CREDIT NOTE)
// =============================================================================

export type InvoiceReturnData = {
  id: string;
  code: string;
  customerName: string;
  grandTotal: number;
  returnedAmount: number;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    unitDiscount: number;
    returnedQuantity: number;
  }[];
};

export async function getInvoiceForReturn(id: string): Promise<InvoiceReturnData | null> {
  const inv = await (await requireTenantPrisma()).invoice.findUnique({
    where: { id },
    include: {
      customer: { select: { name: true } },
      items: {
        include: { product: { select: { name: true } } },
      },
      creditNotes: {
        include: { items: true },
      },
    },
  });

  if (!inv) return null;

  const items = inv.items.map((item) => {
    const returnedQuantity = inv.creditNotes.reduce((sum, cn) => {
      const cnItem = cn.items.find((i) => i.productId === item.productId);
      return sum + (cnItem?.quantity || 0);
    }, 0);

    return {
      productId: item.productId,
      productName: item.product.name,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      unitDiscount: Number(item.discount),
      returnedQuantity,
    };
  });

  return {
    id: inv.id,
    code: inv.code,
    customerName: inv.customer.name,
    grandTotal: Number(inv.grandTotal),
    returnedAmount: Number(inv.returnedAmount || 0),
    items,
  };
}

// =============================================================================
// VOID INVOICE
// =============================================================================

export type VoidResult =
  | { success: true }
  | { success: false; error: string };

export async function voidInvoice(
  invoiceId: string,
  reason: string
): Promise<VoidResult> {
  try {
    await requireRole("OWNER", "MANAGER");
    const userId = await getSystemUserId();
    const tenantId = await getCurrentTenantId();

    const inv = await (await requireTenantPrisma()).invoice.findUnique({
      where: { id: invoiceId },
      include: { items: true },
    });

    if (!inv)                  return { success: false, error: "Nota tidak ditemukan." };
    if (inv.status === "VOID") return { success: false, error: "Nota sudah di-void." };
    if (inv.status === "PAID") return { success: false, error: "Nota yang sudah LUNAS tidak bisa di-void. Hubungi manajer." };

    await (await requireTenantPrisma()).$transaction(async (tx) => {
      // Kembalikan stok FG
      for (const item of inv.items) {
        await appendLedger(tx, {
          data: {
            productId:    item.productId,
            entryType:    "IN",
            refType:      "VOID_REVERSAL",
            refId:        invoiceId,
            quantityUnit: item.quantity,
            notes:        `VOID reversal: ${inv.code}`,
            createdById: userId,
          },
        });
      }

      await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: "VOID", voidReason: reason, voidAt: getCurrentDate() },
      });

      await recordAudit(tx, {
        tenantId,
        userId,
        action: "VOID",
        entityType: "Invoice",
        entityId: invoiceId,
        before: { code: inv.code, status: inv.status },
        after: { status: "VOID", reason },
      });
    });

    revalidatePath("/penjualan");
    revalidatePath("/inventory");
    revalidatePath("/keuangan");
    return { success: true };
  } catch (err) {
    console.error("[voidInvoice]", err);
    return { success: false, error: "Gagal melakukan void." };
  }
}
// =============================================================================
// APPROVE INVOICE & GENERATE MIDTRANS LINK
// =============================================================================

import { createMidtransSnapTransaction } from "@/lib/midtrans";
import { getCurrentDate } from "@/lib/date-utils";

export async function approveInvoiceForMidtrans(invoiceId: string) {
  try {
    await requireRole("OWNER", "MANAGER", "CASHIER");
    await requireFeature("MIDTRANS");
    const prisma = await requireTenantPrisma();
    const inv = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { 
        customer: true,
        tenant: true,
        items: { include: { product: true } }
      },
    });

    if (!inv) return { success: false, error: "Nota tidak ditemukan." };
    if (inv.status !== "DRAFT") return { success: false, error: "Nota tidak berstatus DRAFT." };

    const tenant = inv.tenant;
    let paymentLink: string | null = null;
    let warningMessage: string | null = null;

    if (tenant.midtransServerKey) {
      try {
        const itemDetails = inv.items.map(i => ({
          id: i.productId,
          price: Number(i.unitPrice),
          quantity: i.quantity,
          name: i.product.name.substring(0, 50)
        }));

        const snapParams = {
          order_id: inv.code,
          gross_amount: Math.round(Number(inv.grandTotal)),
          customer_details: {
            first_name: inv.customer.name,
            phone: inv.customer.phone || undefined,
            email: inv.customer.email || undefined,
          },
          item_details: itemDetails
        };

        const snapRes = await createMidtransSnapTransaction(
          decryptCredential(tenant.midtransServerKey),
          tenant.midtransIsProduction,
          snapParams
        );
        paymentLink = snapRes.redirect_url;
      } catch (midtransErr: any) {
        console.error("[approveInvoiceForMidtrans Midtrans Error]", midtransErr);
        warningMessage = midtransErr.message || "Gagal membuat link pembayaran Midtrans.";
      }
    }

    const existingNotes = inv.notes ? inv.notes + "\n\n" : "";
    const newNotes = paymentLink ? `${existingNotes}Link Pembayaran (Midtrans): ${paymentLink}` : inv.notes;

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { 
        status: "ISSUED",
        midtransOrderId: inv.code,
        notes: newNotes
      }
    });

    revalidatePath("/penjualan");
    return { success: true, paymentLink, warning: warningMessage };
  } catch (err: any) {
    console.error("[approveInvoiceForMidtrans]", err);
    return { success: false, error: "Gagal memproses nota: " + (err.message || "Unknown error") };
  }
}

export async function updateInvoiceShipping(
  invoiceId: string, 
  data: { courierName?: string; trackingNumber?: string; shippingCost?: number; shippingMethod?: string }
) {
  try {
    await requireRole("OWNER", "MANAGER", "CASHIER");
    const tenantId = await getCurrentTenantId();
    const userId = await getSystemUserId();
    const tenantPrisma = await requireTenantPrisma();
    const parsed = z.object({
      courierName: z.string().trim().max(100).optional(),
      trackingNumber: z.string().trim().max(150).optional(),
      shippingCost: z.number().nonnegative().max(1_000_000_000).optional(),
      shippingMethod: z.string().trim().max(100).optional(),
    }).parse(data);

    const invoice = await tenantPrisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) return { success: false, error: "Nota tidak ditemukan." };
    if (invoice.status === "VOID") return { success: false, error: "Nota yang sudah di-void tidak dapat diubah." };
    if (invoice.status === "PAID" && parsed.shippingCost !== undefined && parsed.shippingCost !== Number(invoice.shippingCost)) {
      return { success: false, error: "Ongkir nota lunas tidak dapat diubah." };
    }

    const { courierName, trackingNumber, shippingCost, shippingMethod } = parsed;
    const updateData: any = {};
    if (courierName !== undefined) updateData.courierName = courierName;
    if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber;
    if (shippingCost !== undefined) {
      updateData.shippingCost = shippingCost;
      updateData.grandTotal = Number(invoice.subtotal) - Number(invoice.discount) + Number(invoice.tax) + shippingCost;
      if (updateData.grandTotal < Number(invoice.paidAmount)) {
        return { success: false, error: "Total baru tidak boleh lebih kecil dari pembayaran yang sudah diterima." };
      }
    }
    if (shippingMethod !== undefined) updateData.shippingMethod = shippingMethod;

    await tenantPrisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoiceId },
        data: updateData,
      });
      await recordAudit(tx, {
        tenantId,
        userId,
        action: "UPDATE",
        entityType: "InvoiceShipping",
        entityId: invoiceId,
        before: {
          courierName: invoice.courierName,
          trackingNumber: invoice.trackingNumber,
          shippingCost: Number(invoice.shippingCost),
          shippingMethod: invoice.shippingMethod,
        },
        after: updateData,
      });
    });

    revalidatePath("/penjualan");
    return { success: true };
  } catch (error: any) {
    console.error("Update Shipping Error:", error);
    return { success: false, error: "Gagal update data pengiriman: " + error.message };
  }
}

// =============================================================================
// CREATE CREDIT NOTE (RETUR)
// =============================================================================

export type CreditNoteInput = {
  invoiceId: string;
  reason: string;
  items: {
    productId: string;
    quantity: number;
    unitDiscount: number;
  }[];
};

export async function createCreditNote(input: CreditNoteInput) {
  try {
    await requireRole("OWNER", "MANAGER", "CASHIER");
    const tenantId = await getCurrentTenantId();
    const userId = await getSystemUserId();

    if (!tenantId || !userId) {
      return { success: false, error: "Unauthorized" };
    }

    const { invoiceId, reason, items } = input;

    // Validate invoice
    const inv = await (await requireTenantPrisma()).invoice.findUnique({
      where: { id: invoiceId, tenantId },
      include: {
        items: true,
        creditNotes: {
          include: { items: true },
        },
      },
    });

    if (!inv) return { success: false, error: "Invoice not found" };

    // Validate quantities
    for (const item of items) {
      const invItem = inv.items.find((i) => i.productId === item.productId);
      if (!invItem) return { success: false, error: "Product not found in invoice" };

      const returnedQty = inv.creditNotes.reduce((sum, cn) => {
        const cnItem = cn.items.find((i) => i.productId === item.productId);
        return sum + (cnItem?.quantity || 0);
      }, 0);

      if (item.quantity > (invItem.quantity - returnedQty)) {
        return { success: false, error: "Quantity for product exceeds maximum returnable limit" };
      }
    }

    let creditNoteCode = "";

    await (await requireTenantPrisma()).$transaction(async (tx) => {
      // Get next credit note code
      const count = await tx.creditNote.count({ where: { tenantId } });
      const nextId = String(count + 1).padStart(5, "0");
      creditNoteCode = `CN-${nextId}`;

      let totalReturnedAmount = 0;

      const cnItemsData = items.map((item) => {
        const invItem = inv.items.find((i) => i.productId === item.productId)!;
        const unitPrice = invItem.unitPrice;
        const subtotal = (Number(unitPrice) - item.unitDiscount) * item.quantity;
        totalReturnedAmount += subtotal;

        return {
          productId: item.productId,
          quantity: item.quantity,
          unitPrice,
          unitDiscount: item.unitDiscount,
          subtotal,
          tenantId,
        };
      });

      const creditNote = await tx.creditNote.create({
        data: {
          code: creditNoteCode,
          invoiceId,
          total: totalReturnedAmount,
          reason,
          tenantId,
          items: {
            create: cnItemsData,
          },
        },
      });

      // Update Invoice returned amount
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          returnedAmount: {
            increment: totalReturnedAmount,
          },
        },
      });

      // Restore stock via appendLedger
      for (const item of items) {
        await appendLedger(tx, {
          data: {
            tenantId,
            productId: item.productId,
            entryType: "IN",
            quantityUnit: item.quantity,
            refType: "RETURN_FG_IN",
            refId: creditNote.id,
            notes: `Retur dari nota ${inv.code}`,
            createdById: userId,
          },
        });
      }
    });

    revalidatePath("/penjualan");
    return { success: true, creditNoteCode };
  } catch (error: any) {
    console.error("Create Credit Note Error:", error);
    return { success: false, error: error.message || "Terjadi kesalahan internal." };
  }
}
