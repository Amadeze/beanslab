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
import { postCapitalInjection, postOwnerWithdrawal, postCustomerPayment, postExpense, postSupplierPayment, postVoidReversal } from "@/lib/posting";
import { voidPurchaseCore } from "@/lib/purchase-void";
import { calculateSalesPerformance } from "@/lib/financial-reporting";
import { computeSampleCostByType, computeCogsComponentBreakdown } from "@/lib/financial-helpers";
import { prisma } from "@/lib/prisma";

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
      where: { status: { in: ["ISSUED", "PARTIAL"] } },
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
      where: { status: { in: ["ISSUED", "PARTIAL", "PAID"] }, issuedAt: { gte: currentPeriod.start, lt: currentPeriod.end } },
      _sum: { subtotal: true, discount: true },
    }),
    tp.invoice.aggregate({
      where: { status: { in: ["ISSUED", "PARTIAL", "PAID"] }, issuedAt: { gte: previousPeriod.start, lt: previousPeriod.end } },
      _sum: { subtotal: true, discount: true },
    }),
  ]);

  const piutangRows: PiutangRow[] = piutangInvoices.map((inv) => {
    const grandTotal = Number(inv.grandTotal);
    const paidAmount = Number(inv.paidAmount);
    const balance = grandTotal - paidAmount;
    const agingBucket = getReceivableAgingBucket(inv.dueDate, now);
    const shown = inv.items.slice(0, 2);
    const rest  = inv.items.length - shown.length;
    const itemSummary =
      shown.map((i) => `${i.product.name} x${i.quantity}`).join(", ") +
      (rest > 0 ? ` +${rest} lainnya` : "");
    return {
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
    };
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
      select: { code: true },
    });
    if (previousAttempt) {
      const inv = await tenantPrisma.invoice.findFirst({
        where: { payments: { some: { operationKey: opKey } } },
        select: { status: true },
      });
      return { success: true, paymentCode: previousAttempt.code, newStatus: inv?.status ?? "PARTIAL" };
    }
    const result = await tenantPrisma.$transaction(async (tx) => {
      const inv = await tx.invoice.findUnique({
        where: { id: parsed.invoiceId },
        select: { id: true, code: true, grandTotal: true, paidAmount: true, status: true, customer: { select: { name: true } } },
      });
      if (!inv) throw new Error("Nota tidak ditemukan.");
      if (inv.status === "DRAFT") throw new Error("Nota belum diterbitkan.");
      if (inv.status === "PAID") throw new Error("Nota ini sudah lunas.");
      if (inv.status === "VOID") throw new Error("Nota ini sudah di-void.");

      const grandTotal = Number(inv.grandTotal);
      const prevPaid = Number(inv.paidAmount);
      const newPaidTotal = prevPaid + parsed.amount;
      if (newPaidTotal > grandTotal + 0.01) {
        throw new Error(`Nominal melebihi sisa tagihan. Sisa: Rp ${(grandTotal - prevPaid).toLocaleString("id-ID")}`);
      }
      const newStatus: "PAID" | "PARTIAL" =
        newPaidTotal >= grandTotal - 0.01 ? "PAID" : "PARTIAL";

      const payment = await tx.payment.create({
        data: { tenantId, code: payCode, operationKey: opKey, invoiceId: inv.id, amount: parsed.amount, method: parsed.method, reference: refString, paidAt, notes: parsed.notes, createdById: userId },
      });
      await tx.invoice.update({ where: { id: inv.id }, data: { paidAmount: newPaidTotal, status: newStatus } });
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
      await postCustomerPayment(
        payment.id,
        parsed.amount,
        inv.code,
        inv.customer?.name ?? "Customer",
        { tx, tenantId, userId },
      );
      return { newStatus, invoiceCode: inv.code, customerName: inv.customer?.name ?? "Customer" };
    }, { isolationLevel: "Serializable" });
    revalidatePath("/keuangan");
    revalidatePath("/penjualan");

    return { success: true, paymentCode: payCode, newStatus: result.newStatus };
  } catch (err) {
    if (
      typeof err === "object" && err !== null && "code" in err && err.code === "P2002"
      && input.operationKey
    ) {
      const existing = await (await requireTenantPrisma()).payment.findFirst({
        where: { operationKey: input.operationKey },
        select: { code: true },
      });
      if (existing) return { success: true, paymentCode: existing.code, newStatus: "PARTIAL" };
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
    
    const expense = await (await requireTenantPrisma()).$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: { tenantId, date: new Date(parsed.date + "T00:00:00"), category: parsed.category, amount: parsed.amount, description: parsed.description || null, createdById: userId },
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
        { tx, tenantId, userId },
      );
      return created;
    });
    
    if ('isDuplicate' in expense && expense.isDuplicate) {
      return { success: true, id: expense.id };
    }

    revalidatePath("/keuangan");
    revalidatePath("/laporan");

    return { success: true, id: expense.id };
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
      return { success: false, error: "Transaksi sedang diproses. Mohon tunggu sebentar." };
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
    await tp.$transaction(async (tx) => {
      const capitalTxn = await tx.capitalTransaction.create({
        data: {
          tenantId,
          type: "INJECTION",
          amount: input.amount,
          description: input.description?.trim() || null,
          transactionDate: transDate,
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
        { tx, tenantId, userId },
      );
    }, { isolationLevel: "Serializable" });
    revalidatePath("/keuangan");
    revalidatePath("/laporan");
    return { success: true };
  } catch (error) {
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
    await tp.$transaction(async (tx) => {
      const capitalTxn = await tx.capitalTransaction.create({
        data: {
          tenantId,
          type: "WITHDRAWAL",
          amount: input.amount,
          description: input.description?.trim() || null,
          transactionDate: transDate,
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
        { tx, tenantId, userId },
      );
    }, { isolationLevel: "Serializable" });
    revalidatePath("/keuangan");
    revalidatePath("/laporan");
    return { success: true };
  } catch (error) {
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

  const [invoices, expenses, sampleComponents, prevInvoices, prevExpenses, prevSampleComponents, productionBatches] = await Promise.all([
    tp.invoice.findMany({
      where: { voidAt: null, status: { in: ["PAID", "PARTIAL", "ISSUED"] }, issuedAt: { gte: period.start, lt: period.end } },
      select: { subtotal: true, discount: true, tax: true, customer: { select: { name: true } }, items: { select: { quantity: true, subtotal: true, hpp: true, product: { select: { type: true, name: true } } } } },
    }),
    tp.expense.findMany({ where: { voidAt: null, date: { gte: period.start, lt: period.end } }, select: { category: true, amount: true } }),
    tp.sampleUsageComponent.findMany({
      where: { sampleUsage: { status: "COMPLETED", givenAt: { gte: period.start, lt: period.end } } },
      select: { unitCost: true, quantityKg: true, quantityUnit: true, product: { select: { type: true } }, packagingId: true },
    }),
    tp.invoice.findMany({
      where: { voidAt: null, status: { in: ["PAID", "PARTIAL", "ISSUED"] }, issuedAt: { gte: previousPeriod.start, lt: previousPeriod.end } },
      select: { subtotal: true, discount: true, tax: true, customer: { select: { name: true } }, items: { select: { quantity: true, subtotal: true, hpp: true, product: { select: { type: true, name: true } } } } },
    }),
    tp.expense.findMany({ where: { voidAt: null, date: { gte: previousPeriod.start, lt: previousPeriod.end } }, select: { category: true, amount: true } }),
    tp.sampleUsageComponent.findMany({
      where: { sampleUsage: { status: "COMPLETED", givenAt: { gte: previousPeriod.start, lt: previousPeriod.end } } },
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

  const toFinancialInvoices = (rows: typeof invoices) => rows.map((invoice) => ({
    subtotal: Number(invoice.subtotal),
    discount: Number(invoice.discount),
    tax: Number(invoice.tax),
    customerName: invoice.customer?.name ?? null,
    items: invoice.items.map((item) => ({
      productType: item.product?.type ?? null,
      productName: item.product?.name ?? null,
      quantity: item.quantity,
      subtotal: Number(item.subtotal),
      hpp: Number(item.hpp),
    })),
  }));

  const currentSales = calculateSalesPerformance(toFinancialInvoices(invoices));
  const previousSales = calculateSalesPerformance(toFinancialInvoices(prevInvoices));

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
        product: { select: { avgCostPerKg: true } },
        packaging: { select: { avgCostPerUnit: true, costPerUnit: true } },
      },
    });
    return rows.reduce(
      (result, row) => {
        const quantity = Number(row.quantityKg ?? row.quantityUnit ?? 0);
        const unitCost = row.product
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
  const [currentAdjustments, previousAdjustments] = await Promise.all([
    getAdjustmentValues(period.start, period.end),
    getAdjustmentValues(previousPeriod.start, previousPeriod.end),
  ]);

  const opexMap: Record<string, number> = {};
  for (const expense of expenses) {
    opexMap[expense.category] = (opexMap[expense.category] ?? 0) + Number(expense.amount);
  }
  if (currentAdjustments.loss > 0) {
    opexMap.KERUGIAN_MATERIAL = currentAdjustments.loss;
  }
  const currentSampleBreakdown = computeSampleCostByType(sampleComponents);
  const previousSampleBreakdown = computeSampleCostByType(prevSampleComponents);
  for (const [key, value] of Object.entries(currentSampleBreakdown)) {
    if (value > 0) opexMap[key] = value;
  }
  const sampleCost = Object.values(currentSampleBreakdown).reduce((sum, v) => sum + v, 0);
  const opexBreakdown = Object.entries(opexMap).map(([category, amount]) => ({ category, amount }));
  const opex = opexBreakdown.reduce((sum, row) => sum + row.amount, 0);

  const cogs = currentSales.cogs;
  const cogsComponentBreakdown = computeCogsComponentBreakdown(productionBatches, cogs);

  const prevSampleCost = Object.values(previousSampleBreakdown).reduce((sum, v) => sum + v, 0);
  const previousOpex = prevExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0) + previousAdjustments.loss + prevSampleCost;
  const revenue = currentSales.netSales + currentAdjustments.income;
  const revenueBreakdown = [...currentSales.revenueBreakdown];
  if (currentAdjustments.income > 0) {
    revenueBreakdown.push({ category: "PENDAPATAN_LAINNYA", amount: currentAdjustments.income });
  }
  const grossProfit = revenue - currentSales.cogs;
  const netProfit = grossProfit - opex;
  const revenueBreakdownTotal = revenueBreakdown.reduce(
    (sum, row) => sum + row.amount,
    0,
  );

  return { 
    month,
    year,
    grossSales: currentSales.grossSales,
    invoiceDiscount: currentSales.invoiceDiscount,
    tax: currentSales.tax,
    netSales: currentSales.netSales,
    revenue,
    cogs: currentSales.cogs,
    grossProfit,
    opex,
    netProfit,
    opexBreakdown,
    revenueBreakdown,
    cogsBreakdown: currentSales.cogsBreakdown,
    cogsComponentBreakdown,
    salesVolumeUnits: currentSales.salesVolumeUnits,
    topProducts: currentSales.topProducts,
    topCustomers: currentSales.topCustomers,
    previousMonthRevenue: previousSales.netSales + previousAdjustments.income,
    previousMonthCogs: previousSales.cogs,
    previousMonthGrossProfit: previousSales.grossProfit + previousAdjustments.income,
    previousMonthOpex: previousOpex,
    previousMonthNetProfit: previousSales.grossProfit + previousAdjustments.income - previousOpex,
    periodStart: period.start.toISOString(),
    periodEnd: period.end.toISOString(),
    timezone: period.timezone,
    reconciliationDifference: revenue - revenueBreakdownTotal,
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

    const result = await tenantPrisma.$transaction(async (tx) => {
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
        { tx, tenantId, userId },
      );
      return { paymentStatus, purchaseCode: purchase.code, supplierName: purchase.supplier?.name ?? "Supplier" };
    }, { isolationLevel: "Serializable" });

    if ('isDuplicate' in result && result.isDuplicate) {
      return { success: true, newStatus: result.paymentStatus };
    }

    revalidatePath("/inventory");
    revalidatePath("/keuangan");

    return { success: true, newStatus: result.paymentStatus };
  } catch (error: any) {
    if (error.code === "P2002") {
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

    await tenantPrisma.$transaction(async (tx) => {
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
        data: { paidAmount: newPaidAmount, status: newStatus },
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
    }, { isolationLevel: "Serializable" });

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
