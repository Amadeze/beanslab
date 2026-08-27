import { Prisma, type PrismaClient } from "@prisma/client";
import { getCurrentDate, getZonedDayRange } from "@/lib/date-utils";
import { computeReceivable } from "@/lib/finance-formulas";
import { computeRevenue } from "@/lib/report-finance";

export type DailyBriefAction = {
  severity: "INFO" | "WARNING" | "CRITICAL";
  label: string;
  href: string;
};

export type DailyBriefPayload = {
  version: 1;
  reportDate: string;
  timezone: string;
  salesAccrued: number;
  cashCollected: number;
  invoiceCount: number;
  roasting: { batchCount: number; inputKg: number; outputKg: number; yieldPercent: number };
  production: { batchCount: number; unitsProduced: number };
  samples?: { transactionCount: number; packCount: number; totalGrams: number; totalCost: number };
  receivables: { total: number; overdueCount: number; overdueTotal: number };
  payables: { total: number; overdueCount: number; overdueTotal: number };
  inventoryAlertCount: number;
  failedWebhookCount: number;
  actions: DailyBriefAction[];
};

function asJson(payload: DailyBriefPayload): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue;
}

export async function generateDailyBriefForTenant(
  client: PrismaClient,
  tenantId: string,
  now = getCurrentDate(),
): Promise<DailyBriefPayload> {
  const tenant = await client.tenant.findUnique({
    where: { id: tenantId },
    select: { timezone: true, isActive: true },
  });
  if (!tenant?.isActive) throw new Error(`Tenant ${tenantId} is not active.`);

  const period = getZonedDayRange(now, tenant.timezone, -1);
  const [invoices, payments, roasts, productions, samples, receivableInvoices, payablePurchases, products, packagings, failedWebhookCount] = await Promise.all([
    client.invoice.findMany({
      where: {
        tenantId,
        status: { in: ["ISSUED", "PARTIAL", "PAID"] },
        deliveredAt: { gte: period.start, lt: period.end },
        OR: [{ voidAt: null }, { voidAt: { gte: period.end } }],
      },
      select: { grandTotal: true, returnedAmount: true },
    }),
    client.payment.aggregate({
      where: { tenantId, voidAt: null, paidAt: { gte: period.start, lt: period.end } },
      _sum: { amount: true },
    }),
    client.parentRoastingBatch.findMany({
      where: {
        tenantId,
        status: "COMPLETED",
        OR: [
          { completedAt: { gte: period.start, lt: period.end } },
          { completedAt: null, createdAt: { gte: period.start, lt: period.end } },
        ],
      },
      select: { targetWeightKg: true, actualOutputKg: true },
    }),
    client.productionBatch.findMany({
      where: { tenantId, status: "COMPLETED", producedAt: { gte: period.start, lt: period.end } },
      select: { unitsProduced: true },
    }),
    client.sampleUsage.aggregate({
      where: { tenantId, status: "COMPLETED", givenAt: { gte: period.start, lt: period.end } },
      _count: { id: true },
      _sum: { packCount: true, totalGrams: true, totalCost: true },
    }),
    client.invoice.findMany({
      where: { tenantId, status: { in: ["ISSUED", "PARTIAL"] } },
      select: { grandTotal: true, paidAmount: true, returnedAmount: true, dueDate: true },
    }),
    client.purchase.findMany({
      where: { tenantId, status: "COMPLETED", paymentStatus: { in: ["UNPAID", "PARTIAL"] } },
      select: { totalCost: true, paidAmount: true, dueDate: true },
    }),
    client.product.findMany({
      where: { tenantId, isActive: true, reorderAlertEnabled: true },
      select: { type: true, stockKg: true, stockUnit: true, safetyStockQuantity: true },
    }),
    client.packaging.findMany({
      where: { tenantId, isActive: true, reorderAlertEnabled: true },
      select: { stockUnit: true, safetyStockQuantity: true },
    }),
    client.webhookEvent.count({ where: { tenantId, status: "FAILED" } }),
  ]);

  // Pendapatan diakui saat DISERAHKAN (basis kanonik 2F.2), net retur.
  const salesAccrued = computeRevenue(
    invoices.map((invoice) => ({
      grandTotal: invoice.grandTotal,
      returnedAmount: invoice.returnedAmount,
    })),
  );
  const cashCollected = Number(payments._sum.amount ?? 0);
  const roastInput = roasts.reduce((sum, roast) => sum + Number(roast.targetWeightKg), 0);
  const roastOutput = roasts.reduce((sum, roast) => sum + Number(roast.actualOutputKg ?? 0), 0);
  const receivables = receivableInvoices.map((invoice) => {
    const balance = computeReceivable(
      Number(invoice.grandTotal),
      Number(invoice.paidAmount),
      Number(invoice.returnedAmount),
    );
    return {
      balance,
      overdue: Boolean(invoice.dueDate && invoice.dueDate < now && balance > 0.01),
    };
  });
  const payables = payablePurchases.map((purchase) => ({
    balance: Math.max(0, Number(purchase.totalCost) - Number(purchase.paidAmount)),
    overdue: Boolean(purchase.dueDate && purchase.dueDate < now),
  }));
  const inventoryAlertCount = products.filter((product) => {
    const stock = product.type === "GREEN_BEAN" || product.type === "ROASTED_BEAN"
      ? Number(product.stockKg)
      : product.stockUnit;
    return stock <= Number(product.safetyStockQuantity);
  }).length + packagings.filter((packaging) => packaging.stockUnit <= packaging.safetyStockQuantity).length;

  const overdueReceivables = receivables.filter((row) => row.overdue);
  const overduePayables = payables.filter((row) => row.overdue);
  const actions: DailyBriefAction[] = [];
  if (overdueReceivables.length > 0) actions.push({ severity: "CRITICAL", label: `${overdueReceivables.length} piutang melewati jatuh tempo`, href: "/keuangan" });
  if (inventoryAlertCount > 0) actions.push({ severity: "WARNING", label: `${inventoryAlertCount} stok mencapai safety stock`, href: "/inventory" });
  if (overduePayables.length > 0) actions.push({ severity: "WARNING", label: `${overduePayables.length} hutang supplier melewati jatuh tempo`, href: "/keuangan" });
  if (failedWebhookCount > 0) actions.push({ severity: "CRITICAL", label: `${failedWebhookCount} integrasi gagal perlu diperiksa`, href: "/audit" });
  if (actions.length === 0) actions.push({ severity: "INFO", label: "Tidak ada pengecualian kritis pagi ini", href: "/dashboard" });

  const payload: DailyBriefPayload = {
    version: 1,
    reportDate: period.dateKey,
    timezone: period.timezone,
    salesAccrued,
    cashCollected,
    invoiceCount: invoices.length,
    roasting: {
      batchCount: roasts.length,
      inputKg: roastInput,
      outputKg: roastOutput,
      yieldPercent: roastInput > 0 ? (roastOutput / roastInput) * 100 : 0,
    },
    production: {
      batchCount: productions.length,
      unitsProduced: productions.reduce((sum, production) => sum + production.unitsProduced, 0),
    },
    samples: {
      transactionCount: samples._count.id,
      packCount: samples._sum.packCount ?? 0,
      totalGrams: Number(samples._sum.totalGrams ?? 0),
      totalCost: Number(samples._sum.totalCost ?? 0),
    },
    receivables: {
      total: receivables.reduce((sum, row) => sum + row.balance, 0),
      overdueCount: overdueReceivables.length,
      overdueTotal: overdueReceivables.reduce((sum, row) => sum + row.balance, 0),
    },
    payables: {
      total: payables.reduce((sum, row) => sum + row.balance, 0),
      overdueCount: overduePayables.length,
      overdueTotal: overduePayables.reduce((sum, row) => sum + row.balance, 0),
    },
    inventoryAlertCount,
    failedWebhookCount,
    actions,
  };

  await client.dailyBriefSnapshot.upsert({
    where: {
      tenantId_reportDate: {
        tenantId,
        reportDate: new Date(`${period.dateKey}T00:00:00.000Z`),
      },
    },
    create: {
      tenantId,
      reportDate: new Date(`${period.dateKey}T00:00:00.000Z`),
      periodStart: period.start,
      periodEnd: period.end,
      generatedAt: now,
      payload: asJson(payload),
    },
    update: {
      periodStart: period.start,
      periodEnd: period.end,
      generatedAt: now,
      payload: asJson(payload),
    },
  });
  return payload;
}

export async function generateDailyBriefs(client: PrismaClient, now = getCurrentDate()) {
  const tenants = await client.tenant.findMany({
    where: { isActive: true, subscriptionStatus: "ACTIVE" },
    select: { id: true },
  });
  let generated = 0;
  const failures: string[] = [];
  for (const tenant of tenants) {
    try {
      await generateDailyBriefForTenant(client, tenant.id, now);
      generated += 1;
    } catch (error) {
      failures.push(`${tenant.id}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  if (failures.length > 0) throw new Error(`Daily brief failures: ${failures.join("; ")}`);
  return { tenants: tenants.length, generated };
}
