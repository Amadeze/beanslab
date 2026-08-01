"use server";
import { requireTenantPrisma, requireRole } from "@/lib/auth";
import { getCurrentDate, getZonedDayRange } from "@/lib/date-utils";
import type { DailyBriefPayload } from "@/lib/daily-brief";
import { tenantQuery } from "@/lib/tenant-guard";


// =============================================================================
// TYPES
// =============================================================================

export type DashboardKpi = {
  revenueToday:    number; // sum grandTotal nota PAID hari ini
  kasToday:        number; // sum Payment.amount diterima hari ini (semua metode)
  totalPiutang:    number; // sum sisa tagihan ISSUED+PARTIAL
  piutangCount:    number;
  lowStockCount:   number;
  totalKopiTerjual: number;
  averageRoastYield: number; // calculated from totalShrinkagePercent
  averageGrossMargin: number; // (revenue - cogs) / revenue * 100
  sampleCostMonth: number; // total sample cost this month
  samplePacksMonth: number; // total sample packs given this month
};

export type LowStockItem = {
  id:       string;
  name:     string;
  type:     "GREEN_BEAN" | "ROASTED_BEAN" | "FINISHED_GOODS" | "PACKAGING";
  stock:    number;
  unit:     "kg" | "pcs";
  threshold: number;
};

export type RevenueTrend = {
  date: string;
  revenue: number;
};

export type TopProduct = {
  id: string;
  name: string;
  sold: number;
};

export type TopCustomer = {
  id: string;
  name: string;
  totalSpent: number;
};

export type ActivityItem = {
  id:          string;
  type:        "PURCHASE" | "ROASTING" | "PRODUCTION" | "SALE";
  code:        string;
  description: string;
  amount:      number | null;
  status:      string;
  timestamp:   string; // ISO
};

export type DashboardData = {
  kpi:          DashboardKpi;
  revenueTrend: RevenueTrend[];
  topProducts:  TopProduct[];
  topCustomers: TopCustomer[];
  lowStock:     LowStockItem[];
  activity:     ActivityItem[];
  asOf:         string; // ISO
  dailyBrief:   DailyBriefPayload | null;
  operationalQueue: {
    purchaseOrdersToReceive: number;
    roastingBatchesOpen: number;
    paymentReviews: number;
    fulfillmentNeedsProduction: number;
    fulfillmentReadyToPack: number;
    fulfillmentPacked: number;
    overdueReceivables: {
      count: number;
      total: number;
    };
  };
};

// =============================================================================
// MAIN QUERY
// =============================================================================

export async function getDashboardData(): Promise<DashboardData> {
  const user = await requireRole("OWNER", "MANAGER");

  const now = getCurrentDate();
  const tp = await requireTenantPrisma();
  const tenantId = user.tenantId;
  const tenant = await tp.tenant.findUnique({
    where: { id: tenantId },
    select: { timezone: true },
  });
  const today = getZonedDayRange(now, tenant?.timezone);
  const sevenDayPeriod = getZonedDayRange(now, tenant?.timezone, -6);

  // ── All queries fire in parallel ──
  const [
    revenueTodayRaw,
    kasTodayRaw,
    piutangSummary,
    stockProducts,
    stockPackagings,
    recentPurchases,
    recentRoastings,
    recentProductions,
    recentInvoices,
    revenueTrendRaw,
    topProductsRaw,
    topCustomersRaw,
    totalKopiTerjualRaw,
    roastYieldRaw,
    marginRaw,
    dailyBriefSnapshot,
    sampleMonthAgg,
    purchaseOrdersToReceive,
    roastingBatchesOpen,
    paymentReviews,
    fulfillmentGroups,
    overdueReceivables,
  ] = await Promise.all([

    // 1. Revenue hari ini (nota PAID yang diterbitkan hari ini)
    tp.invoice.aggregate({
      where: { status: { in: ["ISSUED", "PARTIAL", "PAID"] }, issuedAt: { gte: today.start, lt: today.end } },
      _sum: { subtotal: true, discount: true },
    }),

    // 2. Kas diterima hari ini (semua Payment yang paidAt hari ini)
    tp.payment.aggregate({
      where: { voidAt: null, paidAt: { gte: today.start, lt: today.end } },
      _sum: { amount: true },
    }),

    // 3. Total piutang outstanding
    tenantQuery<Array<{ totalOutstanding: number; invoiceCount: number }>>(tenantId, async (t) => tp.$queryRaw`
      SELECT
        COALESCE(SUM("grandTotal" - "paidAmount"), 0)::float AS "totalOutstanding",
        COUNT(*)::int AS "invoiceCount"
      FROM "invoices"
      WHERE "tenantId" = ${t}
        AND "status" IN ('ISSUED', 'PARTIAL')
    `),

    // 4a. Stok kg: GB + RB — fetch dari Product cache
    tp.product.findMany({
      where: { isActive: true, type: { in: ["GREEN_BEAN", "ROASTED_BEAN", "FINISHED_GOODS"] } },
      select: {
        id: true,
        name: true,
        type: true,
        stockKg: true,
        stockUnit: true,
        reorderAlertEnabled: true,
        safetyStockQuantity: true,
      },
      orderBy: { name: "asc" },
    }),

    // 4b. Stok FG (unit) — fetch dari Product cache
    tp.packaging.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        stockUnit: true,
        reorderAlertEnabled: true,
        safetyStockQuantity: true,
      },
      orderBy: { name: "asc" },
    }),

    // 4c. Stok Packaging (unit) — fetch dari Packaging cache
    // 5a. Master produk aktif (GB+RB+FG)
    // 5b. Master kemasan aktif
    // 6. Activity: 8 Purchase terbaru
    tp.purchase.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, code: true, type: true, status: true, createdAt: true,
        totalCost: true,
        product:   { select: { name: true } },
        packaging: { select: { name: true } },
        supplier:  { select: { name: true } },
      },
    }),

    // 7. Activity: 8 ParentRoastingBatch terbaru
    tp.parentRoastingBatch.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, code: true, status: true, createdAt: true,
        targetWeightKg: true, actualOutputKg: true, totalShrinkagePercent: true,
        inputProduct:  { select: { name: true } },
        outputProduct: { select: { name: true } },
      },
    }),

    // 8. Activity: 8 ProductionBatch terbaru
    tp.productionBatch.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, code: true, status: true, createdAt: true,
        unitsProduced: true,
        outputProduct: { select: { name: true } },
        packaging:     { select: { name: true } },
      },
    }),

    // 9. Activity: 8 Invoice terbaru
    tp.invoice.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, code: true, status: true, createdAt: true,
        grandTotal: true,
        customer:   { select: { name: true } },
        _count:     { select: { items: true } },
      },
    }),

    // 10. Revenue Trend (Last 7 Days)
    tenantQuery<{ date: string; revenue: number }[]>(tenantId, async (t) => tp.$queryRaw`
      SELECT TO_CHAR(("issuedAt" AT TIME ZONE ${today.timezone})::date, 'YYYY-MM-DD') as "date",
             SUM("subtotal" - "discount")::float as "revenue"
      FROM "invoices"
      WHERE "tenantId" = ${t}
        AND "status" IN ('PAID', 'PARTIAL', 'ISSUED')
        AND "issuedAt" >= ${sevenDayPeriod.start}
        AND "issuedAt" < ${today.end}
      GROUP BY 1
      ORDER BY "date" ASC
    `),

    // 11. Top 5 Products
    tenantQuery<{ id: string; name: string; sold: number }[]>(tenantId, async (t) => tp.$queryRaw`
      SELECT p.id, p."name", SUM(ii."quantity")::int as "sold"
      FROM "invoice_items" ii
      JOIN "products" p ON ii."productId" = p.id
      JOIN "invoices" i ON ii."invoiceId" = i.id
      WHERE i."tenantId" = ${t} AND i."status" IN ('PAID', 'PARTIAL', 'ISSUED')
      GROUP BY p.id, p."name"
      ORDER BY "sold" DESC
      LIMIT 5
    `),

    // 12. Top 5 Customers
    tenantQuery<{ id: string; name: string; totalSpent: number }[]>(tenantId, async (t) => tp.$queryRaw`
      SELECT c.id, c."name", SUM(i."grandTotal")::float as "totalSpent"
      FROM "invoices" i
      JOIN "customers" c ON i."customerId" = c.id
      WHERE i."tenantId" = ${t} AND i."status" IN ('PAID', 'PARTIAL')
      GROUP BY c.id, c."name"
      ORDER BY "totalSpent" DESC
      LIMIT 5
    `),

    // 13. Total Kopi Terjual
    tenantQuery<{ totalSoldKg: number }[]>(tenantId, async (t) => tp.$queryRaw`
      SELECT COALESCE(SUM(il."quantityUnit" * r."outputGrams" / 1000.0), 0)::float as "totalSoldKg"
      FROM "inventory_ledger" il
      JOIN "products" p ON il."productId" = p.id
      LEFT JOIN "recipes" r ON r."productId" = p.id
      WHERE il."tenantId" = ${t} AND il."entryType" = 'OUT' AND il."refType" = 'SALE_FG_OUT' AND p."type" = 'FINISHED_GOODS'
    `),

    // 14. Average Roast Yield
    tp.parentRoastingBatch.aggregate({
      _avg: { totalShrinkagePercent: true },
      where: { status: "COMPLETED" }
    }),

    // 15. Gross Margin (All time)
    tenantQuery<{ totalRevenue: number, totalCogs: number }[]>(tenantId, async (t) => tp.$queryRaw`
      SELECT 
        COALESCE(SUM(ii."subtotal"), 0)::float as "totalRevenue",
        COALESCE(SUM(ii."hpp" * ii."quantity"), 0)::float as "totalCogs"
      FROM "invoice_items" ii
      JOIN "invoices" i ON ii."invoiceId" = i.id
      WHERE i."tenantId" = ${t} AND i."status" IN ('PAID', 'PARTIAL', 'ISSUED')
    `),

    tp.dailyBriefSnapshot.findFirst({
      orderBy: { reportDate: "desc" },
      select: { payload: true },
    }),

    // 16. Sample usage this month
    (() => {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return tp.sampleUsage.aggregate({
        where: { status: "COMPLETED", givenAt: { gte: monthStart, lt: now } },
        _sum: { totalCost: true },
        _count: true,
      });
    })(),

    // 17. Live work queue: PO yang sudah dikirim/diterima sebagian.
    tp.purchaseOrder.count({ where: { status: { in: ["SENT", "PARTIAL"] } } }),

    // 18. Live work queue: batch roasting aktif yang belum mem-posting hasil.
    tp.parentRoastingBatch.count({ where: { status: "PENDING" } }),

    // 19. Live work queue: bukti bayar yang belum membentuk kas.
    tp.paymentSubmission.count({ where: { status: "AWAITING_VERIFICATION" } }),

    // 20. Live work queue: tahap fulfillment yang memerlukan tindakan internal.
    tp.invoice.groupBy({
      by: ["fulfillmentStatus"],
      where: {
        publicOrderToken: { not: null },
        fulfillmentStatus: { in: ["NEEDS_PRODUCTION", "READY_TO_PACK", "PACKED"] },
      },
      _count: true,
    }),

    // 21. Live work queue: hanya piutang yang benar-benar lewat jatuh tempo.
    tp.invoice.aggregate({
      where: { status: { in: ["ISSUED", "PARTIAL"] }, dueDate: { lt: now } },
      _count: true,
      _sum: { grandTotal: true, paidAmount: true },
    }),
  ]);

  // ── KPI calculations ──
  const revenueToday = Number(revenueTodayRaw._sum.subtotal ?? 0) - Number(revenueTodayRaw._sum.discount ?? 0);
  const kasToday     = Number(kasTodayRaw._sum.amount ?? 0);
  const totalPiutang = Number(piutangSummary[0]?.totalOutstanding ?? 0);
  const piutangCount = Number(piutangSummary[0]?.invoiceCount ?? 0);
  const totalKopiTerjual = totalKopiTerjualRaw[0]?.totalSoldKg ?? 0;
  
  // Calculate Roasting Yield (100% - Average Loss %)
  const avgLoss = Number(roastYieldRaw._avg.totalShrinkagePercent ?? 0);
  const averageRoastYield = avgLoss > 0 ? 100 - avgLoss : 0;
  
  // Calculate Gross Margin
  const totalRev = marginRaw[0]?.totalRevenue || 0;
  const totalCogs = marginRaw[0]?.totalCogs || 0;
  const averageGrossMargin = totalRev > 0 ? ((totalRev - totalCogs) / totalRev) * 100 : 0;
  const fulfillmentCount = new Map(
    fulfillmentGroups.map((row) => [row.fulfillmentStatus, row._count]),
  );
  const overdueReceivablesTotal = Math.max(
    0,
    Number(overdueReceivables._sum.grandTotal ?? 0) - Number(overdueReceivables._sum.paidAmount ?? 0),
  );

  // ── Build stock maps ──
  // ── Low stock items ──
  const lowStock: LowStockItem[] = [];

  for (const p of stockProducts) {
    if (!p.reorderAlertEnabled) continue;
    const threshold = Number(p.safetyStockQuantity);
    if (p.type === "FINISHED_GOODS") {
      const stock = Number(p.stockUnit);
      if (stock <= threshold) {
        lowStock.push({
          id: p.id, name: p.name, type: "FINISHED_GOODS",
          stock, unit: "pcs", threshold,
        });
      }
    } else {
      const stock = Number(p.stockKg);
      if (stock <= threshold) {
        lowStock.push({
          id: p.id, name: p.name,
          type: p.type as "GREEN_BEAN" | "ROASTED_BEAN",
          stock, unit: "kg", threshold,
        });
      }
    }
  }

  for (const pkg of stockPackagings) {
    if (!pkg.reorderAlertEnabled) continue;
    const stock = Number(pkg.stockUnit);
    const threshold = Number(pkg.safetyStockQuantity);
    if (stock <= threshold) {
      lowStock.push({
        id: pkg.id, name: pkg.name, type: "PACKAGING",
        stock, unit: "pcs", threshold,
      });
    }
  }

  // ── Transform Charts Data ──
  const revenueTrendMap = new Map(revenueTrendRaw.map(r => [
    r.date,
    r.revenue
  ]));

  const revenueTrend: RevenueTrend[] = [];
  for (let offset = -6; offset <= 0; offset++) {
    const day = getZonedDayRange(now, today.timezone, offset);
    const label = new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      timeZone: today.timezone,
    }).format(day.start);
    
    revenueTrend.push({
      date: label,
      revenue: revenueTrendMap.get(day.dateKey) ?? 0,
    });
  }

  // ── Build activity feed ──
  const STATUS_TX: Record<string, string> = {
    COMPLETED: "Selesai", PENDING: "Proses", VOID: "Void",
  };
  const STATUS_INV: Record<string, string> = {
    PAID: "Lunas", ISSUED: "Tempo", PARTIAL: "Sebagian", DRAFT: "Draft", VOID: "Void",
  };

  const activities: ActivityItem[] = [
    ...recentPurchases.map((p) => ({
      id:          p.id,
      type:        "PURCHASE" as const,
      code:        p.code,
      description: `${p.type === "GREEN_BEAN"
        ? `GB ${p.product?.name ?? "—"}`
        : `PKG ${p.packaging?.name ?? "—"}`} · ${p.supplier.name}`,
      amount:      Number(p.totalCost),
      status:      STATUS_TX[p.status] ?? p.status,
      timestamp:   p.createdAt.toISOString(),
    })),

    ...recentRoastings.map((r) => ({
      id:          r.id,
      type:        "ROASTING" as const,
      code:        r.code,
      description: `${r.inputProduct.name} → ${r.outputProduct.name} · ${Number(r.totalShrinkagePercent).toFixed(1)}% susut`,
      amount:      null,
      status:      STATUS_TX[r.status] ?? r.status,
      timestamp:   r.createdAt.toISOString(),
    })),

    ...recentProductions.map((p) => ({
      id:          p.id,
      type:        "PRODUCTION" as const,
      code:        p.code,
      description: `${p.outputProduct.name} · ${p.unitsProduced} unit · ${p.packaging.name}`,
      amount:      null,
      status:      STATUS_TX[p.status] ?? p.status,
      timestamp:   p.createdAt.toISOString(),
    })),

    ...recentInvoices.map((inv) => ({
      id:          inv.id,
      type:        "SALE" as const,
      code:        inv.code,
      description: `${inv.customer.name} · ${inv._count.items} item`,
      amount:      Number(inv.grandTotal),
      status:      STATUS_INV[inv.status] ?? inv.status,
      timestamp:   inv.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 20);

  return {
    kpi: {
      revenueToday,
      kasToday,
      totalPiutang,
      piutangCount,
      lowStockCount: lowStock.length,
      totalKopiTerjual,
      averageRoastYield,
      averageGrossMargin,
      sampleCostMonth: Number(sampleMonthAgg._sum.totalCost ?? 0),
      samplePacksMonth: sampleMonthAgg._count,
    },
    revenueTrend,
    topProducts: topProductsRaw,
    topCustomers: topCustomersRaw,
    lowStock,
    activity: activities,
    asOf: now.toISOString(),
    dailyBrief: dailyBriefSnapshot?.payload as DailyBriefPayload | null ?? null,
    operationalQueue: {
      purchaseOrdersToReceive,
      roastingBatchesOpen,
      paymentReviews,
      fulfillmentNeedsProduction: fulfillmentCount.get("NEEDS_PRODUCTION") ?? 0,
      fulfillmentReadyToPack: fulfillmentCount.get("READY_TO_PACK") ?? 0,
      fulfillmentPacked: fulfillmentCount.get("PACKED") ?? 0,
      overdueReceivables: {
        count: overdueReceivables._count,
        total: overdueReceivablesTotal,
      },
    },
  };
}
