"use server";

import { z } from 'zod';
import { revalidatePath } from "next/cache";
import { getCurrentTenantId, getSystemUserId, requireRole, requireTenantPrisma } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { randomBytes } from "crypto";
import { appendLedger } from "@/lib/stock";
import { getPurchasePaymentStatus, getReceivableAgingBucket, type ReceivableAgingBucket as _ReceivableAgingBucket } from "@/lib/purchase-payments";
export type ReceivableAgingBucket = _ReceivableAgingBucket;
import { getCurrentDate, getZonedMonthRange } from "@/lib/date-utils";
import { postCapitalInjection, postOwnerWithdrawal, postCustomerPayment, postCustomerPrepayment, postExpense, postSupplierPayment, postVoidReversal } from "@/lib/posting";
import { markInvoicePaidForFulfillment } from "@/lib/storefront-commerce";
import { voidPurchaseCore } from "@/lib/purchase-void";
import { computeSampleCostByType, computeCogsComponentBreakdown } from "@/lib/financial-helpers";
import { prisma } from "@/lib/prisma";
import { withSerializableRetry } from "@/lib/transaction-retry";

// =============================================================================
// TYPES
// =============================================================================

export type PiutangRow = {
  id: string;
  code: string;
  customerName: string;
  customerPhone: string | null;
  grandTotal: number;
  paidAmount: number;
  balance: number;
  status: "ISSUED" | "PARTIAL";
  issuedAt: string;
  dueDate: string | null;
  agingBucket: ReceivableAgingBucket;
  itemSummary: string;
};

export type AgingBucketSummary = {
  current: { count: number; total: number };
  overdue1_30: { count: number; total: number };
  overdue31_60: { count: number; total: number };
  overdue61Plus: { count: number; total: number };
};

export type KpiSummary = {
  totalPiutang: number;
  piutangCount: number;
  overdueCount: number;
  overdueTotal: number;
  agingBuckets: AgingBucketSummary;
  revenueMTD: number;
  revenueLastMonth: number;
};

export type KeuanganPageData = {
  piutangRows: PiutangRow[];
  kpi: KpiSummary;
};

export type RecordPaymentInput = {
  operationKey?: string;
  invoiceId: string;
  amount: number;
  method: "CASH" | "TRANSFER" | "QRIS" | "CREDIT";
  paidAt: string;
  bankName?: string;
  reference?: string;
  notes?: string;
};

const RecordPaymentSchema = z.object({
  operationKey: z.string().uuid().optional(),
  invoiceId: z.string().min(1),
  amount: z.number().positive("Nominal harus lebih dari 0"),
  method: z.enum(["CASH", "TRANSFER", "QRIS", "CREDIT"]),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid"),
  bankName: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export type PaymentActionResult =
  | { success: true; paymentCode: string; newStatus: string }
  | { success: false; error: string };

export type CreateExpenseInput = {
  operationKey?: string;
  date: string;
  category: "UTILITAS" | "OPERASIONAL" | "LAINNYA";
  amount: number;
  description?: string;
};

const CreateExpenseSchema = z.object({
  operationKey: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid"),
  category: z.enum(["UTILITAS", "OPERASIONAL", "LAINNYA"]),
  amount: z.number().positive("Nominal harus lebih dari 0"),
  description: z.string().optional(),
});

export type CreateExpenseResult =
  | { success: true; id: string }
  | { success: false; error: string };

export type ExpenseRow = {
  id: string;
  date: string;
  category: string;
  amount: number;
  description: string | null;
  createdAt: string;
};

export type PurchaseRow = {
  id: string;
  code: string;
  receivedAt: string;
  itemName: string;
  type: string;
  supplierName: string;
  quantity: string;
  totalCost: number;
  paidAmount: number;
  balance: number;
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
  dueDate: string | null;
  isOverdue: boolean;
  createdAt: string;
};

export type SupplierPaymentRow = {
  id: string;
  code: string;
  purchaseCode: string;
  supplierName: string;
  amount: number;
  method: string;
  paidAt: string;
  reference: string | null;
};

export type PaymentRow = {
  id: string;
  code: string;
  invoiceCode: string;
  customerName: string;
  amount: number;
  method: string;
  paidAt: string;
  reference: string | null;
};

export type PnLReport = {
  month: number;
  year: number;
  grossSales: number;
  invoiceDiscount: number;
  tax: number;
  netSales: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  opex: number;
  netProfit: number;
  opexBreakdown: { category: string; amount: number }[];
  revenueBreakdown: { category: string; amount: number }[];
  cogsBreakdown: { category: string; amount: number }[];
  cogsComponentBreakdown: { category: string; amount: number }[];
  salesVolumeUnits: number;
  topProducts: { name: string; quantity: number; revenue: number }[];
  topCustomers: { name: string; count: number; revenue: number }[];
  previousMonthRevenue?: number;
  previousMonthCogs?: number;
  previousMonthGrossProfit?: number;
  previousMonthOpex?: number;
  previousMonthNetProfit?: number;
  periodStart: string;
  periodEnd: string;
  timezone: string;
  reconciliationDifference: number;
};

// =============================================================================
// PAGE DATA
// =============================================================================

export async function getKeuanganPageData(): Promise<KeuanganPageData> {
  await requireRole("OWNER", "MANAGER");
  const tp = await requireTenantPrisma();
  const tenantId = await getCurrentTenantId();
  const now = getCurrentDate();
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } });
  const localNow = new Intl.DateTimeFormat("en-CA", {
    timeZone: tenant?.timezone ?? "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(localNow.find((part) => part.type === "year")?.value);
  const month = Number(localNow.find((part) => part.type === "month")?.value);
  const currentPeriod = getZonedMonthRange(year, month, tenant?.timezone);
  const previousPeriod = getZonedMonthRange(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1, tenant?.timezone);

  const [piutangInvoices, revenueMTDRaw, revenueLastMonthRaw] = await Promise.all([
    tp.invoice.findMany({
      where: { status: { in: ["ISSUED", "PARTIAL"] }, voidAt: null },
      include: {
        customer: { select: { name: true, phone: true } },
        items: {
          include: { product: { select: { name: true } } },
          take: 3,
          orderBy: { id: "asc" },
        },
      },
    }),
    tp.invoice.aggregate({
      where: {
        deliveredAt: { gte: currentPeriod.start, lt: currentPeriod.end },
        OR: [{ voidAt: null }, { voidAt: { gte: currentPeriod.end } }],
      },
      _sum: { subtotal: true, discount: true },
    }),
    tp.invoice.aggregate({
      where: {
        deliveredAt: { gte: previousPeriod.start, lt: previousPeriod.end },
        OR: [{ voidAt: null }, { voidAt: { gte: previousPeriod.end } }],
      },
      _sum: { subtotal: true, discount: true },
    }),
  ]);

  const piutangRows: PiutangRow[] = piutangInvoices.flatMap((inv) => {
    const grandTotal = Number(inv.grandTotal);
    const paidAmount = Number(inv.paidAmount);
    const returnedAmount = Number(inv.returnedAmount);
    // Piutang = tagihan − pembayaran − nilai retur (bukan hanya pembayaran).
    const balance = Math.max(0, Math.round((grandTotal - paidAmount - returnedAmount) * 100) / 100);
    if (balance <= 0.01) return [];
    const agingBucket = getReceivableAgingBucket(inv.dueDate, now);
    const shown = inv.items.slice(0, 2);
    const rest  = inv.items.length - shown.length;
    const itemSummary =
      shown.map((i) => `${i.product.name} x${i.quantity}`).join(", ") +
      (rest > 0 ? ` +${rest} lainnya` : "");
    return [{
      id: inv.id,
      code: inv.code,
      customerName: inv.customer.name,
      customerPhone: inv.customer.phone,
      grandTotal,
      paidAmount,
      balance,
      status: inv.status as "ISSUED" | "PARTIAL",
      issuedAt: inv.issuedAt.toISOString(),
      dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
      agingBucket,
      itemSummary,
    }];
  });

  // Sort: most overdue first, then by due date ascending
  const bucketOrder: Record<ReceivableAgingBucket, number> = {
    "OVERDUE_61_PLUS": 0,
    "OVERDUE_31_60": 1,
    "OVERDUE_1_30": 2,
    "CURRENT": 3,
  };
  piutangRows.sort((a, b) => {
    const bucketDiff = bucketOrder[a.agingBucket] - bucketOrder[b.agingBucket];
    if (bucketDiff !== 0) return bucketDiff;
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  const totalPiutang = piutangRows.reduce((s, r) => s + r.balance, 0);
  const overdueRows = piutangRows.filter((r) => r.agingBucket !== "CURRENT");
  const overdueCount = overdueRows.length;
  const overdueTotal = overdueRows.reduce((s, r) => s + r.balance, 0);

  function bucketCount(bucket: ReceivableAgingBucket) {
    return piutangRows.filter((r) => r.agingBucket === bucket).length;
  }
  function bucketTotal(bucket: ReceivableAgingBucket) {
    return piutangRows.filter((r) => r.agingBucket === bucket).reduce((s, r) => s + r.balance, 0);
  }

  return {
    piutangRows,
    kpi: {
      totalPiutang,
      piutangCount: piutangRows.length,
      overdueCount,
      overdueTotal,
      agingBuckets: {
        current:       { count: bucketCount("CURRENT"),       total: bucketTotal("CURRENT") },
        overdue1_30:   { count: bucketCount("OVERDUE_1_30"),   total: bucketTotal("OVERDUE_1_30") },
        overdue31_60:  { count: bucketCount("OVERDUE_31_60"),  total: bucketTotal("OVERDUE_31_60") },
        overdue61Plus: { count: bucketCount("OVERDUE_61_PLUS"), total: bucketTotal("OVERDUE_61_PLUS") },
      },
      revenueMTD: Number(revenueMTDRaw._sum.subtotal ?? 0) - Number(revenueMTDRaw._sum.discount ?? 0),
      revenueLastMonth: Number(revenueLastMonthRaw._sum.subtotal ?? 0) - Number(revenueLastMonthRaw._sum.discount ?? 0),
    },
  };
}

// =============================================================================
// RECORD PAYMENT
// =============================================================================

export async function recordPayment(input: RecordPaymentInput): Promise<PaymentActionResult> {
  try {
    await requireRole("OWNER", "MANAGER", "CASHIER");
    const parsed = RecordPaymentSchema.parse(input);
    const userId = await getSystemUserId();
    const tenantId = await getCurrentTenantId();
    
    const opKey = parsed.operationKey || randomBytes(16).toString("hex");
    const paidAt = new Date(parsed.paidAt + "T00:00:00");
    const prefix = `PAY-${paidAt.getFullYear()}${String(paidAt.getMonth() + 1).padStart(2, "0")}`;
    const payCode = `${prefix}-${randomBytes(4).toString("hex").toUpperCase()}`;
    const refParts = [parsed.bankName, parsed.reference].filter(Boolean);
    const refString = refParts.length > 0 ? refParts.join(" / ") : undefined;
    const tenantPrisma = await requireTenantPrisma();
    const previousAttempt = await tenantPrisma.payment.findFirst({
      where: { operationKey: opKey },
      select: { code: true, invoice: { select: { status: true } } },
    });
    if (previousAttempt) {
      return {
        success: true,
        paymentCode: previousAttempt.code,
        newStatus: previousAttempt.invoice.status,
      };
    }
    const result = await withSerializableRetry(tenantPrisma, async (tx) => {
      const lockedRows = await tx.$queryRaw`
        SELECT "id" FROM "invoices"
        WHERE "id" = ${parsed.invoiceId} AND "tenantId" = ${tenantId}
        FOR UPDATE
      ` as Array<{ id: string }>;
      if (lockedRows.length === 0) throw new Error("Nota tidak ditemukan.");

      const committedAttempt = await tx.payment.findFirst({
        where: { operationKey: opKey },
        select: { code: true, invoice: { select: { status: true } } },
      });
      if (committedAttempt) {
        return {
          paymentCode: committedAttempt.code,
          newStatus: committedAttempt.invoice.status,
        };
      }

      const inv = await tx.invoice.findUnique({
        where: { id: parsed.invoiceId },
        select: { id: true, code: true, grandTotal: true, paidAmount: true, returnedAmount: true, status: true, fulfillmentStatus: true, createdById: true, customer: { select: { name: true } } },
      });
      if (!inv) throw new Error("Nota tidak ditemukan.");
      if (inv.status === "DRAFT") throw new Error("Nota belum diterbitkan.");
      if (inv.status === "PAID") throw new Error("Nota ini sudah lunas.");
      if (inv.status === "VOID") throw new Error("Nota ini sudah di-void.");
      if (inv.status === "RETURNED") {
        throw new Error("Nota yang sudah diretur penuh tidak dapat menerima pembayaran.");
      }

      const grandTotal = Number(inv.grandTotal);
      // Nilai yang dapat dibayar = tagihan − nilai retur (2F.2): retur
      // mengurangi porsi yang masih dapat ditagih.
      const round2 = (n: number) => Math.round(n * 100) / 100;
      const maxPayable = Math.max(0, round2(grandTotal - Number(inv.returnedAmount)));
      const prevPaid = Number(inv.paidAmount);
      const newPaidTotal = prevPaid + parsed.amount;
      if (newPaidTotal > maxPayable + 0.01) {
        throw new Error(`Nominal melebihi sisa tagihan. Sisa: Rp ${Math.max(0, round2(maxPayable - prevPaid)).toLocaleString("id-ID")}`);
      }
      const newStatus: "PAID" | "PARTIAL" =
        newPaidTotal >= grandTotal - 0.01 ? "PAID" : "PARTIAL";

      const payment = await tx.payment.create({
        data: { tenantId, code: payCode, operationKey: opKey, invoiceId: inv.id, amount: parsed.amount, method: parsed.method, reference: refString, paidAt, notes: parsed.notes, createdById: userId },
      });
      await tx.invoice.update({ where: { id: inv.id }, data: { paidAmount: newPaidTotal, status: newStatus } });
      const settledBeforeHandover = inv.fulfillmentStatus !== "DELIVERED";
      if (settledBeforeHandover && newStatus === "PAID") {
        await markInvoicePaidForFulfillment(tx, {
          tenantId, invoiceId: inv.id, invoiceCode: inv.code, createdById: inv.createdById, now: paidAt,
        });
      }
      await recordAudit(tx, {
        tenantId,
        userId,
        action: "CREATE",
        entityType: "Payment",
        entityId: payment.id,
        after: {
          code: payment.code,
          invoiceId: inv.id,
          amount: Number(payment.amount),
          method: payment.method,
        },
      });
      await (settledBeforeHandover ? postCustomerPrepayment : postCustomerPayment)(
        payment.id,
        parsed.amount,
        inv.code,
        inv.customer?.name ?? "Customer",
        { tx, tenantId, userId, date: paidAt },
      );
      return { paymentCode: payment.code, newStatus };
    });
    revalidatePath("/keuangan");
    revalidatePath("/penjualan");

    return { success: true, paymentCode: result.paymentCode, newStatus: result.newStatus };
  } catch (err) {
    if (
      typeof err === "object" && err !== null && "code" in err && err.code === "P2002"
      && input.operationKey
    ) {
      const existing = await (await requireTenantPrisma()).payment.findFirst({
        where: { operationKey: input.operationKey },
        select: { code: true, invoice: { select: { status: true } } },
      });
      if (existing) {
        return {
          success: true,
          paymentCode: existing.code,
          newStatus: existing.invoice.status,
        };
      }
    }
    console.error("[recordPayment]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal mencatat pembayaran. Coba lagi.",
    };
  }
}

// =============================================================================
// CREATE EXPENSE
// =============================================================================

export async function createExpense(input: CreateExpenseInput): Promise<CreateExpenseResult> {
  try {
    await requireRole("OWNER", "MANAGER");
    const parsed = CreateExpenseSchema.parse(input);
    const userId = await getSystemUserId();
    const tenantId = await getCurrentTenantId();
    
    const opKey = parsed.operationKey || randomBytes(16).toString("hex");
    const tenantPrisma = await requireTenantPrisma();
    const previousAttempt = await tenantPrisma.expense.findFirst({
      where: { operationKey: opKey },
      select: { id: true },
    });
    if (previousAttempt) return { success: true, id: previousAttempt.id };

    const expense = await tenantPrisma.$transaction(async (tx) => {
      const committedAttempt = await tx.expense.findFirst({
        where: { operationKey: opKey },
        select: { id: true },
      });
      if (committedAttempt) return committedAttempt;

      const created = await tx.expense.create({
        data: { tenantId, date: new Date(parsed.date + "T00:00:00"), category: parsed.category, amount: parsed.amount, description: parsed.description || null, operationKey: opKey, createdById: userId },
      });
      await recordAudit(tx, {
        tenantId,
        userId,
        action: "CREATE",
        entityType: "Expense",
        entityId: created.id,
        after: {
          date: created.date,
          category: created.category,
          amount: Number(created.amount),
          description: created.description,
        },
      });
      await postExpense(
        created.id,
        parsed.amount,
        parsed.category,
        parsed.description ?? "Pengeluaran",
        { tx, tenantId, userId, date: created.date },
      );
      return created;
    });

    revalidatePath("/keuangan");
    revalidatePath("/laporan");

    return { success: true, id: expense.id };
  } catch (err: unknown) {
    if (
      typeof err === "object" && err !== null && "code" in err && err.code === "P2002"
      && input.operationKey
    ) {
      const existing = await (await requireTenantPrisma()).expense.findFirst({
        where: { operationKey: input.operationKey },
        select: { id: true },
      });
      if (existing) return { success: true, id: existing.id };
    }
    console.error("[createExpense]", err);
    return { success: false, error: "Gagal mencatat pengeluaran. Coba lagi." };
  }
}

// =============================================================================
// CAPITAL MANAGEMENT (Mutasi Modal)
// =============================================================================

export type CapitalTransactionRow = {
  id: string;
  type: "INITIAL" | "INJECTION" | "WITHDRAWAL" | "DIVIDEND";
  amount: number;
  description: string | null;
  transactionDate: string;
  createdByName: string;
  createdAt: string;
};

export type CapitalSummary = {
  totalInitial: number;
  totalInjections: number;
  totalWithdrawals: number;
  totalDividends: number;
  netCapital: number;
  count: number;
};

export type RecordCapitalInput = {
  type: "INJECTION" | "WITHDRAWAL" | "DIVIDEND";
  amount: number;
  description?: string;
  transactionDate: string;
  operationKey?: string;
};

export async function getCapitalHistory(): Promise<CapitalTransactionRow[]> {
  await requireRole("OWNER", "MANAGER");
  const rows = await (await requireTenantPrisma()).capitalTransaction.findMany({
    orderBy: { transactionDate: "desc" },
    include: { createdBy: { select: { name: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    type: row.type as CapitalTransactionRow["type"],
    amount: Number(row.amount),
    description: row.description,
    transactionDate: row.transactionDate.toISOString(),
    createdByName: row.createdBy.name,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getCapitalSummary(): Promise<CapitalSummary> {
  await requireRole("OWNER", "MANAGER");
  const tp = await requireTenantPrisma();
  const [initial, injections, withdrawals, dividends] = await Promise.all([
    tp.capitalTransaction.aggregate({ where: { type: "INITIAL" }, _sum: { amount: true } }),
    tp.capitalTransaction.aggregate({ where: { type: "INJECTION" }, _sum: { amount: true } }),
    tp.capitalTransaction.aggregate({ where: { type: "WITHDRAWAL" }, _sum: { amount: true } }),
    tp.capitalTransaction.aggregate({ where: { type: "DIVIDEND" }, _sum: { amount: true } }),
  ]);
  const totalInitial = Number(initial._sum.amount ?? 0);
  const totalInjections = Number(injections._sum.amount ?? 0);
  const totalWithdrawals = Number(withdrawals._sum.amount ?? 0);
  const totalDividends = Number(dividends._sum.amount ?? 0);
  return {
    totalInitial,
    totalInjections,
    totalWithdrawals,
    totalDividends,
    netCapital: totalInitial + totalInjections - totalWithdrawals - totalDividends,
    count: 0,
  };
}

export async function getCapitalSummaryQuick(): Promise<CapitalSummary> {
  await requireRole("OWNER", "MANAGER");
  const tp = await requireTenantPrisma();
  const [grouped, countResult] = await Promise.all([
    tp.capitalTransaction.groupBy({
      by: ["type"],
      _sum: { amount: true },
    }),
    tp.capitalTransaction.count(),
  ]);
  const sums: Record<string, number> = {};
  for (const group of grouped) {
    sums[group.type] = Number(group._sum.amount ?? 0);
  }
  const totalInitial = sums["INITIAL"] ?? 0;
  const totalInjections = sums["INJECTION"] ?? 0;
  const totalWithdrawals = sums["WITHDRAWAL"] ?? 0;
  const totalDividends = sums["DIVIDEND"] ?? 0;
  return {
    totalInitial,
    totalInjections,
    totalWithdrawals,
    totalDividends,
    netCapital: totalInitial + totalInjections - totalWithdrawals - totalDividends,
    count: countResult,
  };
}

export async function recordCapitalInjection(
  input: RecordCapitalInput,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireRole("OWNER");
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      return { success: false, error: "Nominal harus lebih dari 0." };
    }
    const transDate = new Date(`${input.transactionDate}T00:00:00`);
    if (Number.isNaN(transDate.getTime())) {
      return { success: false, error: "Tanggal tidak valid." };
    }
    const userId = await getSystemUserId();
    const tenantId = await getCurrentTenantId();
    const tp = await requireTenantPrisma();
    const opKey = input.operationKey || randomBytes(16).toString("hex");
    const previousAttempt = await tp.capitalTransaction.findFirst({
      where: { operationKey: opKey },
      select: { id: true },
    });
    if (previousAttempt) return { success: true };

    await withSerializableRetry(tp, async (tx) => {
      const committedAttempt = await tx.capitalTransaction.findFirst({
        where: { operationKey: opKey },
        select: { id: true },
      });
      if (committedAttempt) return;

      const capitalTxn = await tx.capitalTransaction.create({
        data: {
          tenantId,
          type: "INJECTION",
          amount: input.amount,
          description: input.description?.trim() || null,
          transactionDate: transDate,
          operationKey: opKey,
          createdById: userId,
        },
      });
      await recordAudit(tx, {
        tenantId,
        userId,
        action: "CREATE",
        entityType: "CapitalTransaction",
        entityId: capitalTxn.id,
        after: { type: capitalTxn.type, amount: Number(capitalTxn.amount) },
      });
      await postCapitalInjection(
        capitalTxn.id,
        input.amount,
        input.description ?? "Setoran modal",
        { tx, tenantId, userId, date: transDate },
      );
    });
    revalidatePath("/keuangan");
    revalidatePath("/laporan");
    return { success: true };
  } catch (error) {
    if (
      typeof error === "object" && error !== null && "code" in error
      && (error as { code?: string }).code === "P2002" && input.operationKey
    ) {
      const existing = await (await requireTenantPrisma()).capitalTransaction.findFirst({
        where: { operationKey: input.operationKey },
        select: { id: true },
      });
      if (existing) return { success: true };
    }
    console.error("[recordCapitalInjection]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal mencatat transaksi modal.",
    };
  }
}

export async function recordOwnerWithdrawal(
  input: RecordCapitalInput,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireRole("OWNER");
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      return { success: false, error: "Nominal harus lebih dari 0." };
    }
    const transDate = new Date(`${input.transactionDate}T00:00:00`);
    if (Number.isNaN(transDate.getTime())) {
      return { success: false, error: "Tanggal tidak valid." };
    }
    const summary = await getCapitalSummary();
    if (input.amount > summary.netCapital) {
      return {
        success: false,
        error: `Saldo modal hanya Rp ${summary.netCapital.toLocaleString("id-ID")}, tidak cukup untuk prive sebesar Rp ${input.amount.toLocaleString("id-ID")}.`,
      };
    }
    const userId = await getSystemUserId();
    const tenantId = await getCurrentTenantId();
    const tp = await requireTenantPrisma();
    const opKey = input.operationKey || randomBytes(16).toString("hex");
    const previousAttempt = await tp.capitalTransaction.findFirst({
      where: { operationKey: opKey },
      select: { id: true },
    });
    if (previousAttempt) return { success: true };

    // Validasi saldo modal OTORITATIF di dalam transaksi, di bawah lock
    // tenant-scoped. Tanpa lock, dua prive bersamaan bisa lolos dari snapshot
    // yang sama (TOCTOU) dan menarik melebihi modal yang tersedia.
    await withSerializableRetry(tp, async (tx) => {
      const committedAttempt = await tx.capitalTransaction.findFirst({
        where: { operationKey: opKey },
        select: { id: true },
      });
      if (committedAttempt) return;

      const lockedRows = await tx.$queryRaw`
        SELECT "id" FROM "capital_transactions"
        WHERE "tenantId" = ${tenantId}
        FOR UPDATE
      ` as Array<{ id: string }>;
      if (lockedRows.length === 0) {
        await tx.$queryRaw`
          SELECT "id" FROM "tenants"
          WHERE "id" = ${tenantId}
          FOR UPDATE
        `;
      }

      const [initial, injections, withdrawals, dividends] = await Promise.all([
        tx.capitalTransaction.aggregate({ where: { type: "INITIAL" }, _sum: { amount: true } }),
        tx.capitalTransaction.aggregate({ where: { type: "INJECTION" }, _sum: { amount: true } }),
        tx.capitalTransaction.aggregate({ where: { type: "WITHDRAWAL" }, _sum: { amount: true } }),
        tx.capitalTransaction.aggregate({ where: { type: "DIVIDEND" }, _sum: { amount: true } }),
      ]);
      const netCapital =
        Number(initial._sum.amount ?? 0)
        + Number(injections._sum.amount ?? 0)
        - Number(withdrawals._sum.amount ?? 0)
        - Number(dividends._sum.amount ?? 0);
      if (input.amount > netCapital) {
        throw new Error(
          `Saldo modal hanya Rp ${netCapital.toLocaleString("id-ID")}, tidak cukup untuk prive sebesar Rp ${input.amount.toLocaleString("id-ID")}.`,
        );
      }

      const capitalTxn = await tx.capitalTransaction.create({
        data: {
          tenantId,
          type: "WITHDRAWAL",
          amount: input.amount,
          description: input.description?.trim() || null,
          transactionDate: transDate,
          operationKey: opKey,
          createdById: userId,
        },
      });
      await recordAudit(tx, {
        tenantId,
        userId,
        action: "CREATE",
        entityType: "CapitalTransaction",
        entityId: capitalTxn.id,
        after: { type: capitalTxn.type, amount: Number(capitalTxn.amount) },
      });
      await postOwnerWithdrawal(
        capitalTxn.id,
        input.amount,
        input.description ?? "Penarikan prive",
        { tx, tenantId, userId, date: transDate },
      );
    });
    revalidatePath("/keuangan");
    revalidatePath("/laporan");
    return { success: true };
  } catch (error) {
    if (
      typeof error === "object" && error !== null && "code" in error
      && (error as { code?: string }).code === "P2002" && input.operationKey
    ) {
      const existing = await (await requireTenantPrisma()).capitalTransaction.findFirst({
        where: { operationKey: input.operationKey },
        select: { id: true },
      });
      if (existing) return { success: true };
    }
    console.error("[recordOwnerWithdrawal]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal mencatat prive.",
    };
  }
}

// =============================================================================
// P&L REPORT
// =============================================================================

export async function getPnLReport(month: number, year: number): Promise<PnLReport> {
  if (
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isInteger(year) ||
    year < 2000 ||
    year > 2100
  ) {
    throw new Error("Periode laporan tidak valid.");
  }
  let prevMonth = month - 1;
  let prevYear  = year;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear -= 1;
  }
  const tenantId = await getCurrentTenantId();
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { timezone: true },
  });
  const period = getZonedMonthRange(year, month, tenant?.timezone);
  const previousPeriod = getZonedMonthRange(prevYear, prevMonth, tenant?.timezone);
  const tp = await requireTenantPrisma();

  // ── GL-derived top lines ───────────────────────────────────────────────────
  // Pendapatan/COGS/OPEX diambil dari jurnal (tanggal ekonomi transaksi),
  // bukan dari query operasional. Jadi angka utama P&L SELALU sama dengan
  // buku besar; rincian operasional di bawah hanya penjelas.
  const journalSelect = {
    lines: {
      select: { debit: true, credit: true, account: { select: { code: true, type: true } } },
    },
  } as const;
  type GlLine = {
    debit: unknown;
    credit: unknown;
    account: { code: string; type: string };
  };
  const glCreditNet = (entries: { lines: GlLine[] }[], match: (account: { code: string; type: string }) => boolean) =>
    entries.reduce(
      (total, entry) => total + entry.lines.reduce(
        (sum, line) => sum + (match(line.account) ? Number(line.credit) - Number(line.debit) : 0),
        0,
      ),
      0,
    );
  const glDebitNet = (entries: { lines: GlLine[] }[], match: (account: { code: string; type: string }) => boolean) =>
    entries.reduce(
      (total, entry) => total + entry.lines.reduce(
        (sum, line) => sum + (match(line.account) ? Number(line.debit) - Number(line.credit) : 0),
        0,
      ),
      0,
    );
  const isRevenueAccount = (account: { code: string; type: string }) => account.type === "REVENUE";
  const isCogsAccount = (account: { code: string; type: string }) => account.type === "EXPENSE" && account.code.startsWith("5-1");
  const isOpexAccount = (account: { code: string; type: string }) => account.type === "EXPENSE" && !account.code.startsWith("5-1");

  const [journals, prevJournals, deliveredInvoices, creditNotes, voidedInvoices, expenses, sampleComponents, productionBatches] = await Promise.all([
    tp.journalEntry.findMany({ where: { date: { gte: period.start, lt: period.end } }, select: journalSelect }),
    tp.journalEntry.findMany({ where: { date: { gte: previousPeriod.start, lt: previousPeriod.end } }, select: journalSelect }),
    // Diserahkan dalam periode: pendapatan diakui saat penyerahan (deliveredAt),
    // termasuk nota yang baru di-void SETELAH periode berakhir.
    tp.invoice.findMany({
      where: {
        deliveredAt: { gte: period.start, lt: period.end },
        OR: [{ voidAt: null }, { voidAt: { gte: period.end } }],
      },
      select: {
        subtotal: true, discount: true, tax: true,
        customer: { select: { name: true } },
        items: { select: { quantity: true, subtotal: true, hpp: true, product: { select: { type: true, name: true } } } },
      },
    }),
    // Retur dalam periode (tanggal ekonomi = tanggal pencatatan retur).
    tp.creditNote.findMany({
      where: { createdAt: { gte: period.start, lt: period.end } },
      select: {
        invoice: { select: { subtotal: true, tax: true, items: { select: { productId: true, hpp: true } } } },
        items: { select: { quantity: true, subtotal: true, productId: true, product: { select: { type: true, name: true } } } },
      },
    }),
    // Nota yang diserahkan periode SEBELUMNYA lalu di-void dalam periode ini:
    // reversal penuh. Nota yang diserahkan DAN di-void di periode yang sama
    // tidak tampil di sini maupun di deliveredInvoices (net nol — jurnal dan
    // pembaliknya sama-sama berada dalam periode ini).
    tp.invoice.findMany({
      where: {
        voidAt: { gte: period.start, lt: period.end },
        NOT: [{ deliveredAt: null }, { deliveredAt: { gte: period.start, lt: period.end } }],
      },
      select: {
        subtotal: true, discount: true, tax: true,
        items: { select: { quantity: true, subtotal: true, hpp: true, product: { select: { type: true, name: true } } } },
      },
    }),
    tp.expense.findMany({ where: { voidAt: null, date: { gte: period.start, lt: period.end } }, select: { category: true, amount: true } }),
    tp.sampleUsageComponent.findMany({
      where: { sampleUsage: { status: "COMPLETED", givenAt: { gte: period.start, lt: period.end } } },
      select: { unitCost: true, quantityKg: true, quantityUnit: true, product: { select: { type: true } }, packagingId: true },
    }),
    tp.productionBatch.findMany({
      where: { status: "COMPLETED", voidAt: null, producedAt: { gte: period.start, lt: period.end } },
      select: {
        hppPerUnit: true,
        unitsProduced: true,
        laborCost: true,
        overheadAllocated: true,
        totalRbUsedKg: true,
        packaging: { select: { costPerUnit: true, avgCostPerUnit: true } },
      },
    }),
  ]);

  const revenue = glCreditNet(journals, isRevenueAccount);
  const cogs = glDebitNet(journals, isCogsAccount);
  const opex = glDebitNet(journals, isOpexAccount);
  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - opex;

  const prevRevenue = glCreditNet(prevJournals, isRevenueAccount);
  const prevCogs = glDebitNet(prevJournals, isCogsAccount);
  const prevOpex = glDebitNet(prevJournals, isOpexAccount);

  // ── Rincian operasional (dasar penyerahan, net of retur & void) ───────────
  const revenueByCategory = new Map<string, number>();
  const cogsByCategory = new Map<string, number>();
  const products = new Map<string, { quantity: number; revenue: number }>();
  const customers = new Map<string, { count: number; revenue: number }>();
  let grossSales = 0;
  let invoiceDiscount = 0;
  let tax = 0;
  let salesVolumeUnits = 0;

  const addTo = (map: Map<string, number>, key: string, amount: number) => {
    if (Math.abs(amount) <= 0.005) return;
    map.set(key, (map.get(key) ?? 0) + amount);
  };
  const categoryOf = (productType: string | null) => productType || "LAINNYA";

  for (const invoice of deliveredInvoices) {
    const headerSubtotal = Math.max(0, Number(invoice.subtotal));
    const headerDiscount = Math.min(Math.max(0, Number(invoice.discount)), headerSubtotal);
    const lineSubtotal = invoice.items.reduce((sum, item) => sum + Math.max(0, Number(item.subtotal)), 0);
    const netFactor = lineSubtotal > 0 ? (headerSubtotal - headerDiscount) / lineSubtotal : 0;
    const invoiceNet = headerSubtotal - headerDiscount;

    grossSales += headerSubtotal;
    invoiceDiscount += headerDiscount;
    tax += Math.max(0, Number(invoice.tax));

    const customerName = invoice.customer?.name?.trim();
    if (customerName && customerName.toLocaleLowerCase("id-ID") !== "umum") {
      const current = customers.get(customerName) ?? { count: 0, revenue: 0 };
      current.count += 1;
      current.revenue += invoiceNet;
      customers.set(customerName, current);
    }

    for (const item of invoice.items) {
      const category = categoryOf(item.product?.type ?? null);
      const productName = item.product?.name ?? "Produk Tidak Dikenal";
      const itemRevenue = Math.max(0, Number(item.subtotal)) * netFactor;
      addTo(revenueByCategory, category, itemRevenue);
      addTo(cogsByCategory, category, Math.max(0, Number(item.hpp)) * Math.max(0, item.quantity));
      salesVolumeUnits += Math.max(0, item.quantity);

      const product = products.get(productName) ?? { quantity: 0, revenue: 0 };
      product.quantity += Math.max(0, item.quantity);
      product.revenue += itemRevenue;
      products.set(productName, product);
    }
  }

  for (const creditNote of creditNotes) {
    const invoiceSubtotal = Math.max(0, Number(creditNote.invoice?.subtotal ?? 0));
    const taxShare = invoiceSubtotal > 0 ? Math.max(0, Number(creditNote.invoice?.tax ?? 0)) / invoiceSubtotal : 0;
    const sourceByProduct = new Map((creditNote.invoice?.items ?? []).map((item) => [item.productId, item]));
    for (const item of creditNote.items) {
      const category = categoryOf(item.product?.type ?? null);
      // Neto retur = subtotal baris − porsi pajak — persis seperti jurnal
      // CREDIT_NOTE (Dr 4-1000 sebesar neto setelah pajak).
      addTo(revenueByCategory, category, -(Math.max(0, Number(item.subtotal)) * (1 - taxShare)));
      // COGS retur memakai HPP baris invoice ASLI (historis, bukan cache saat ini).
      const source = sourceByProduct.get(item.productId);
      const hpp = source ? Number(source.hpp) : 0;
      addTo(cogsByCategory, category, -(hpp * Math.max(0, item.quantity)));
    }
  }

  for (const invoice of voidedInvoices) {
    const headerSubtotal = Math.max(0, Number(invoice.subtotal));
    const headerDiscount = Math.min(Math.max(0, Number(invoice.discount)), headerSubtotal);
    const lineSubtotal = invoice.items.reduce((sum, item) => sum + Math.max(0, Number(item.subtotal)), 0);
    const netFactor = lineSubtotal > 0 ? (headerSubtotal - headerDiscount) / lineSubtotal : 0;
    for (const item of invoice.items) {
      const category = categoryOf(item.product?.type ?? null);
      addTo(revenueByCategory, category, -(Math.max(0, Number(item.subtotal)) * netFactor));
      addTo(cogsByCategory, category, -(Math.max(0, Number(item.hpp)) * Math.max(0, item.quantity)));
    }
  }

  // Penyesuaian stok: nilai memakai basis biaya DURABEL dari ledger (incomingPrice),
  // bukan harga rata-rata produk saat ini (yang bisa berubah setelah periode).
  const getAdjustmentValues = async (start: Date, end: Date) => {
    const rows = await tp.inventoryLedger.findMany({
      where: {
        refType: { in: ["ADJUSTMENT_IN", "ADJUSTMENT_OUT"] },
        createdAt: { gte: start, lt: end },
        NOT: { refType: "VOID_REVERSAL" },
      },
      select: {
        refType: true,
        quantityKg: true,
        quantityUnit: true,
        supplyQuantity: true,
        incomingPrice: true,
        product: { select: { avgCostPerKg: true } },
        packaging: { select: { avgCostPerUnit: true, costPerUnit: true } },
      },
    });
    return rows.reduce(
      (result, row) => {
        const quantity = Number(row.quantityKg ?? row.quantityUnit ?? row.supplyQuantity ?? 0);
        const unitCost = row.incomingPrice != null
          ? Number(row.incomingPrice)
          : row.product
            ? Number(row.product.avgCostPerKg ?? 0)
            : Number(row.packaging?.avgCostPerUnit ?? row.packaging?.costPerUnit ?? 0);
        const value = quantity * unitCost;
        if (row.refType === "ADJUSTMENT_IN") result.income += value;
        if (row.refType === "ADJUSTMENT_OUT") result.loss += value;
        return result;
      },
      { income: 0, loss: 0 },
    );
  };
  const [currentAdjustments] = await Promise.all([
    getAdjustmentValues(period.start, period.end),
  ]);

  // Penyesuaian masuk GL sebagai kredit 5-1040 (mengurangi HPP) dan keluar
  // sebagai debit 5-1040 — tampilkan satu baris bertanda di HPP.
  const adjustmentNet = currentAdjustments.loss - currentAdjustments.income;
  addTo(cogsByCategory, "KERUGIAN_MATERIAL", adjustmentNet);

  const opexMap: Record<string, number> = {};
  for (const expense of expenses) {
    opexMap[expense.category] = (opexMap[expense.category] ?? 0) + Number(expense.amount);
  }
  const currentSampleBreakdown = computeSampleCostByType(sampleComponents);
  for (const [key, value] of Object.entries(currentSampleBreakdown)) {
    if (value > 0) opexMap[key] = value;
  }

  const opexBreakdown = Object.entries(opexMap).map(([category, amount]) => ({ category, amount }));
  const revenueBreakdown = [...revenueByCategory].map(([category, amount]) => ({ category, amount }));
  const cogsBreakdown = [...cogsByCategory].map(([category, amount]) => ({ category, amount }));
  const revenueBreakdownTotal = revenueBreakdown.reduce((sum, row) => sum + row.amount, 0);
  const cogsComponentBreakdown = computeCogsComponentBreakdown(productionBatches, cogs);
  const netSales = grossSales - invoiceDiscount;

  return {
    month,
    year,
    grossSales,
    invoiceDiscount,
    tax,
    netSales,
    revenue,
    cogs,
    grossProfit,
    opex,
    netProfit,
    opexBreakdown,
    revenueBreakdown,
    cogsBreakdown,
    cogsComponentBreakdown,
    salesVolumeUnits,
    topProducts: [...products]
      .map(([name, values]) => ({ name, ...values }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5),
    topCustomers: [...customers]
      .map(([name, values]) => ({ name, ...values }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5),
    previousMonthRevenue: prevRevenue,
    previousMonthCogs: prevCogs,
    previousMonthGrossProfit: prevRevenue - prevCogs,
    previousMonthOpex: prevOpex,
    previousMonthNetProfit: prevRevenue - prevCogs - prevOpex,
    periodStart: period.start.toISOString(),
    periodEnd: period.end.toISOString(),
    timezone: period.timezone,
    // Selisih pendapatan GL vs rincian operasional (mis. penyesuaian ongkir,
    // jurnal lain yang menyentuh 4-1000) — 0 bila seluruh pendapatan berasal
    // dari penjualan yang diserahkan di periode ini.
    reconciliationDifference: Math.round((revenue - revenueBreakdownTotal) * 100) / 100,
  };
}

// =============================================================================
// GET EXPENSE HISTORY
// =============================================================================

export async function getExpenseHistory(): Promise<ExpenseRow[]> {
  const expenses = await (await requireTenantPrisma()).expense.findMany({
    where: { voidAt: null },
    orderBy: { date: "desc" },
    take: 200,
    select: { id: true, date: true, category: true, amount: true, description: true, createdAt: true },
  });
  return expenses.map((e) => ({ id: e.id, date: e.date.toISOString(), category: e.category, amount: Number(e.amount), description: e.description, createdAt: e.createdAt.toISOString() }));
}

export async function voidExpense(expenseId: string, reason: string) {
  try {
    await requireRole("OWNER", "MANAGER");
    if (!reason.trim()) return { success: false, error: "Alasan void wajib diisi." };
    const tenantId = await getCurrentTenantId();
    const userId = await getSystemUserId();
    const tenantPrisma = await requireTenantPrisma();
    await tenantPrisma.$transaction(async (tx) => {
      const expense = await tx.expense.findUnique({ where: { id: expenseId } });
      if (!expense) throw new Error("Pengeluaran tidak ditemukan.");
      if (expense.voidAt) throw new Error("Pengeluaran sudah di-void.");
      await tx.expense.update({
        where: { id: expense.id },
        data: { voidReason: reason.trim(), voidAt: getCurrentDate() },
      });
      await postVoidReversal("EXPENSE", expense.id, reason, { tx, tenantId, userId });
      await recordAudit(tx, {
        tenantId,
        userId,
        action: "VOID",
        entityType: "Expense",
        entityId: expense.id,
        before: {
          date: expense.date,
          category: expense.category,
          amount: Number(expense.amount),
        },
        after: { voidAt: getCurrentDate(), reason: reason.trim() },
      });
    }, { isolationLevel: "Serializable" });
    revalidatePath("/keuangan");
    revalidatePath("/laporan");
    return { success: true };
  } catch (error) {
    console.error("[voidExpense]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal melakukan void pengeluaran.",
    };
  }
}

// =============================================================================
// GET PURCHASE HISTORY
// =============================================================================

export async function getPurchaseHistory(): Promise<PurchaseRow[]> {
  const purchases = await (await requireTenantPrisma()).purchase.findMany({
    where: { status: "COMPLETED" },
    orderBy: { receivedAt: "desc" },
    take: 200,
    include: {
      product: { select: { name: true } },
      packaging: { select: { name: true } },
      supplier: { select: { name: true } }
    }
  });

  return purchases.map((p) => {
    let itemName = "Tidak diketahui";
    let quantity = "-";
    if (p.type === "GREEN_BEAN" && p.product) {
      itemName = p.product.name;
      quantity = `${Number(p.weightKg)} kg`;
    } else if (p.type === "PACKAGING" && p.packaging) {
      itemName = p.packaging.name;
      quantity = `${Number(p.quantityUnits)} unit`;
    }

    return {
      id: p.id,
      code: p.code,
      receivedAt: p.receivedAt.toISOString(),
      itemName,
      type: p.type,
      supplierName: p.supplier?.name || "Supplier Umum",
      quantity,
      totalCost: Number(p.totalCost),
      paidAmount: Number(p.paidAmount),
      balance: Math.max(0, Number(p.totalCost) - Number(p.paidAmount)),
      paymentStatus: p.paymentStatus,
      dueDate: p.dueDate?.toISOString() ?? null,
      isOverdue: p.paymentStatus !== "PAID" && Boolean(p.dueDate && p.dueDate < getCurrentDate()),
      createdAt: p.createdAt.toISOString()
    };
  });
}

export async function getSupplierPaymentHistory(): Promise<SupplierPaymentRow[]> {
  const payments = await (await requireTenantPrisma()).supplierPayment.findMany({
    where: { voidAt: null },
    orderBy: { paidAt: "desc" },
    take: 200,
    include: {
      purchase: {
        select: {
          code: true,
          supplier: { select: { name: true } },
        },
      },
    },
  });

  return payments.map((payment) => ({
    id: payment.id,
    code: payment.code,
    purchaseCode: payment.purchase.code,
    supplierName: payment.purchase.supplier.name,
    amount: Number(payment.amount),
    method: payment.method,
    paidAt: payment.paidAt.toISOString(),
    reference: payment.reference,
  }));
}

export type RecordSupplierPaymentInput = {
  operationKey?: string;
  purchaseId: string;
  amount: number;
  method: "CASH" | "TRANSFER" | "QRIS";
  paidAt: string;
  reference?: string;
  notes?: string;
};

export async function recordSupplierPayment(input: RecordSupplierPaymentInput) {
  try {
    await requireRole("OWNER", "MANAGER", "CASHIER");
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      return { success: false, error: "Nominal harus lebih dari 0." };
    }
    const paidAt = new Date(`${input.paidAt}T00:00:00`);
    if (Number.isNaN(paidAt.getTime())) {
      return { success: false, error: "Tanggal pembayaran tidak valid." };
    }

    const tenantId = await getCurrentTenantId();
    const userId = await getSystemUserId();
    const prefix = `SPAY-${paidAt.getFullYear()}${String(paidAt.getMonth() + 1).padStart(2, "0")}`;
    const paymentCode = `${prefix}-${randomBytes(4).toString("hex").toUpperCase()}`;
    const tenantPrisma = await requireTenantPrisma();

    const opKey = input.operationKey || randomBytes(16).toString("hex");
    const previousAttempt = await tenantPrisma.supplierPayment.findFirst({
      where: { operationKey: opKey },
      select: { id: true, purchase: { select: { paymentStatus: true } } },
    });
    if (previousAttempt) {
      return { success: true, newStatus: previousAttempt.purchase.paymentStatus };
    }

    const result = await withSerializableRetry(tenantPrisma, async (tx) => {
      const lockedRows = await tx.$queryRaw`
        SELECT "id" FROM "purchases"
        WHERE "id" = ${input.purchaseId} AND "tenantId" = ${tenantId}
        FOR UPDATE
      ` as Array<{ id: string }>;
      if (lockedRows.length === 0) throw new Error("Pembelian tidak ditemukan.");

      const committedAttempt = await tx.supplierPayment.findFirst({
        where: { operationKey: opKey },
        select: { id: true },
      });
      if (committedAttempt) {
        return { paymentStatus: "PARTIAL", purchaseCode: "", supplierName: "", isDuplicate: true };
      }

      const purchase = await tx.purchase.findUnique({
        where: { id: input.purchaseId },
        select: {
          id: true,
          code: true,
          status: true,
          paymentStatus: true,
          totalCost: true,
          paidAmount: true,
          supplier: { select: { name: true } },
        },
      });
      if (!purchase) throw new Error("Pembelian tidak ditemukan.");
      if (purchase.status !== "COMPLETED") {
        throw new Error("Pembayaran hanya dapat dicatat untuk pembelian aktif.");
      }
      if (purchase.paymentStatus === "PAID") throw new Error("Pembelian ini sudah lunas.");

      const totalCost = Number(purchase.totalCost);
      const previousPaid = Number(purchase.paidAmount);
      const newPaidAmount = previousPaid + input.amount;
      if (newPaidAmount > totalCost + 0.01) {
        throw new Error(`Nominal melebihi sisa hutang. Sisa: Rp ${(totalCost - previousPaid).toLocaleString("id-ID")}`);
      }
      const paymentStatus = getPurchasePaymentStatus(newPaidAmount, totalCost);

      const payment = await tx.supplierPayment.create({
        data: {
          tenantId,
          code: paymentCode,
          operationKey: opKey,
          purchaseId: purchase.id,
          amount: input.amount,
          method: input.method,
          reference: input.reference?.trim() || null,
          paidAt,
          notes: input.notes?.trim() || null,
          createdById: userId,
        },
      });
      await tx.purchase.update({
        where: { id: purchase.id },
        data: { paidAmount: newPaidAmount, paymentStatus },
      });
      await recordAudit(tx, {
        tenantId,
        userId,
        action: "CREATE",
        entityType: "SupplierPayment",
        entityId: payment.id,
        after: {
          code: payment.code,
          purchaseId: purchase.id,
          amount: Number(payment.amount),
          paymentStatus,
        },
      });
      await postSupplierPayment(
        payment.id,
        input.amount,
        purchase.code,
        purchase.supplier?.name ?? "Supplier",
        { tx, tenantId, userId, date: paidAt },
      );
      return { paymentStatus, purchaseCode: purchase.code, supplierName: purchase.supplier?.name ?? "Supplier", isDuplicate: false };
    });

    if (result.isDuplicate) {
      return { success: true, newStatus: result.paymentStatus };
    }

    revalidatePath("/inventory");
    revalidatePath("/keuangan");

    return { success: true, newStatus: result.paymentStatus };
  } catch (error: any) {
    if (error.code === "P2002" && input.operationKey) {
      const existing = await (await requireTenantPrisma()).supplierPayment.findFirst({
        where: { operationKey: input.operationKey },
        select: { id: true, purchase: { select: { paymentStatus: true } } },
      });
      if (existing) return { success: true, newStatus: existing.purchase.paymentStatus };
      return { success: false, error: "Pembayaran sedang diproses. Mohon tunggu sebentar." };
    }
    console.error("[recordSupplierPayment]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal mencatat pembayaran supplier.",
    };
  }
}

export async function voidSupplierPayment(paymentId: string, reason: string) {
  try {
    await requireRole("OWNER", "MANAGER");
    if (!reason.trim()) return { success: false, error: "Alasan void wajib diisi." };
    const tenantId = await getCurrentTenantId();
    const userId = await getSystemUserId();
    const tenantPrisma = await requireTenantPrisma();

    await tenantPrisma.$transaction(async (tx) => {
      const payment = await tx.supplierPayment.findUnique({
        where: { id: paymentId },
        include: { purchase: true },
      });
      if (!payment) throw new Error("Pembayaran supplier tidak ditemukan.");
      if (payment.voidAt) throw new Error("Pembayaran supplier sudah di-void.");

      // Pembayaran awal (saat penerimaan barang) tidak punya jurnal SUPPLIER_PAYMENT
      // sendiri — ia sudah dibukukan oleh jurnal PURCHASE. Tidak boleh di-void
      // mandiri; koreksinya melalui void Pembelian terkait.
      const hasJournal = await tx.journalEntry.count({
        where: { tenantId, refType: "SUPPLIER_PAYMENT", reference: payment.id, voidAt: null },
      });
      if (hasJournal === 0) {
        throw new Error(
          "Pembayaran awal (saat penerimaan barang) tidak dapat dibatalkan secara mandiri. Batalkan melalui void Pembelian terkait.",
        );
      }
      if (payment.purchase.status !== "COMPLETED") {
        throw new Error("Pembayaran pada pembelian nonaktif tidak dapat diubah.");
      }

      const newPaidAmount = Math.max(
        0,
        Number(payment.purchase.paidAmount) - Number(payment.amount),
      );
      const paymentStatus = getPurchasePaymentStatus(
        newPaidAmount,
        Number(payment.purchase.totalCost),
      );
      await tx.supplierPayment.update({
        where: { id: payment.id },
        data: { voidReason: reason.trim(), voidAt: getCurrentDate() },
      });
      await postVoidReversal("SUPPLIER_PAYMENT", payment.id, reason, { tx, tenantId, userId });
      await tx.purchase.update({
        where: { id: payment.purchaseId },
        data: { paidAmount: newPaidAmount, paymentStatus },
      });
      await recordAudit(tx, {
        tenantId,
        userId,
        action: "VOID",
        entityType: "SupplierPayment",
        entityId: payment.id,
        before: {
          amount: Number(payment.amount),
          purchasePaidAmount: Number(payment.purchase.paidAmount),
          purchasePaymentStatus: payment.purchase.paymentStatus,
        },
        after: {
          reason: reason.trim(),
          purchasePaidAmount: newPaidAmount,
          purchasePaymentStatus: paymentStatus,
        },
      });
    }, { isolationLevel: "Serializable" });

    revalidatePath("/keuangan");
    revalidatePath("/laporan");
    return { success: true };
  } catch (error) {
    console.error("[voidSupplierPayment]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal melakukan void pembayaran supplier.",
    };
  }
}

export async function getPaymentHistory(): Promise<PaymentRow[]> {
  const payments = await (await requireTenantPrisma()).payment.findMany({
    where: { voidAt: null },
    orderBy: { paidAt: "desc" },
    take: 200,
    include: {
      invoice: {
        select: {
          code: true,
          customer: { select: { name: true } },
        },
      },
    },
  });
  return payments.map((payment) => ({
    id: payment.id,
    code: payment.code,
    invoiceCode: payment.invoice.code,
    customerName: payment.invoice.customer.name,
    amount: Number(payment.amount),
    method: payment.method,
    paidAt: payment.paidAt.toISOString(),
    reference: payment.reference,
  }));
}

export async function voidPayment(paymentId: string, reason: string) {
  try {
    await requireRole("OWNER", "MANAGER");
    if (!reason.trim()) return { success: false, error: "Alasan void wajib diisi." };
    const tenantId = await getCurrentTenantId();
    const userId = await getSystemUserId();
    const tenantPrisma = await requireTenantPrisma();

    await withSerializableRetry(tenantPrisma, async (tx) => {
      const lockedRows = await tx.$queryRaw`
        SELECT "id" FROM "payments"
        WHERE "id" = ${paymentId} AND "tenantId" = ${tenantId}
        FOR UPDATE
      ` as Array<{ id: string }>;
      if (lockedRows.length === 0) throw new Error("Pembayaran tidak ditemukan.");

      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { invoice: true },
      });
      if (!payment) throw new Error("Pembayaran tidak ditemukan.");
      if (payment.voidAt) throw new Error("Pembayaran sudah di-void.");
      if (payment.invoice.status === "VOID") {
        throw new Error("Pembayaran pada invoice void tidak dapat diubah.");
      }

      const newPaidAmount = Math.max(
        0,
        Number(payment.invoice.paidAmount) - Number(payment.amount),
      );
      const newStatus: "ISSUED" | "PARTIAL" =
        newPaidAmount <= 0.01 ? "ISSUED" : "PARTIAL";
      await tx.payment.update({
        where: { id: payment.id },
        data: { voidReason: reason.trim(), voidAt: getCurrentDate() },
      });
      await postVoidReversal("PAYMENT", payment.id, reason, { tx, tenantId, userId });
      await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus,
          ...(payment.invoice.fulfillmentStatus === "READY_TO_PACK"
            && !(payment.invoice.salesChannel === "B2B_DIRECT" && payment.invoice.paymentMethod === "CREDIT")
            ? { fulfillmentStatus: "AWAITING_PAYMENT" as const }
            : {}),
        },
      });
      await recordAudit(tx, {
        tenantId,
        userId,
        action: "VOID",
        entityType: "Payment",
        entityId: payment.id,
        before: {
          code: payment.code,
          amount: Number(payment.amount),
          invoiceStatus: payment.invoice.status,
          invoicePaidAmount: Number(payment.invoice.paidAmount),
        },
        after: {
          reason: reason.trim(),
          invoiceStatus: newStatus,
          invoicePaidAmount: newPaidAmount,
        },
      });
    });

    revalidatePath("/keuangan");
    revalidatePath("/penjualan");
    return { success: true };
  } catch (error) {
    console.error("[voidPayment]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal melakukan void pembayaran.",
    };
  }
}

export async function voidPurchase(purchaseId: string, reason: string) {
  try {
    await requireRole("OWNER", "MANAGER");
    const tenantId = await getCurrentTenantId();
    const userId = await getSystemUserId();
    const tenantPrisma = await requireTenantPrisma();

    await voidPurchaseCore(tenantPrisma, tenantId, userId, purchaseId, reason);

    revalidatePath("/keuangan");
    revalidatePath("/inventory");
    revalidatePath("/laporan");
    return { success: true };
  } catch (error) {
    console.error("[voidPurchase]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Gagal melakukan void pembelian.",
    };
  }
}
