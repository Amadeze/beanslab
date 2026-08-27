"use server";
import { requireTenantPrisma, requireRole } from "@/lib/auth";
import { getCurrentDate, getZonedDayRange } from "@/lib/date-utils";
import type { DailyBriefPayload } from "@/lib/daily-brief";
import { tenantQuery } from "@/lib/tenant-guard";
import { computeRevenue } from "@/lib/report-finance";
import { netSoldKg } from "@/lib/sales-volume";


// =============================================================================
// TYPES
// =============================================================================

export type DashboardKpi = {
  revenueToday:    number; // pendapatan nota DIKIRIM hari ini, net retur (definisi kanonik tunggal: grandTotal − retur)
  kasToday:        number; // sum Payment.amount diterima hari ini (semua metode)
  totalPiutang:    number; // sum sisa tagihan ISSUED+PARTIAL bersih retur (2F.2)
  piutangCount:    number;
  lowStockCount:   number;
  totalKopiTerjual: number;
  /** Unit terjual dari produk jadi TANPA resep (tidak dapat dikonversi ke kg). */
  totalSoldUnitsNoWeight: number;
  averageRoastYield: number; // calculated from totalShrinkagePercent
  averageGrossMargin: number; // (revenue - cogs) / revenue * 100, net retur & diskon
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
  lowStock:     LowStockItem[];
  activity:     ActivityItem[];
  asOf:         string; // ISO
  dailyBrief:   DailyBriefPayload | null;
  /** Agregat arus kopi 30 hari (kg) untuk mini Sankey Hari Ini. */
  coffeeFlowMini: {
    beliKg: number;
    diRoastKg: number;
    susutKg: number;
  };
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

export type TodayData = {
  asOf: string;
  role: "OWNER" | "MANAGER" | "OPERATOR" | "CASHIER";
  lowStock: LowStockItem[];
  operationalQueue: DashboardData["operationalQueue"];
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
  const thirtyDayPeriod = getZonedDayRange(now, tenant?.timezone, -29);

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
    soldLedgerEntries,
    productRecipes,
    roastYieldRaw,
    marginRaw,
    dailyBriefSnapshot,
    purchaseOrdersToReceive,
    roastingBatchesOpen,
    paymentReviews,
    fulfillmentGroups,
    overdueReceivables,
    coffeeFlowMiniRaw,
  ] = await Promise.all([

    // 1. Revenue hari ini (nota yang DIKIRIM hari ini; pengakuan berbasis pengiriman 2F.2)
    tp.invoice.aggregate({
      where: {
        deliveredAt: { gte: today.start, lt: today.end },
        OR: [{ voidAt: null }, { voidAt: { gte: today.end } }],
      },
      _sum: { grandTotal: true, returnedAmount: true },
    }),

    // 2. Kas diterima hari ini (semua Payment yang paidAt hari ini)
    tp.payment.aggregate({
      where: { voidAt: null, paidAt: { gte: today.start, lt: today.end } },
      _sum: { amount: true },
    }),

    // 3. Total piutang outstanding (piutang = tagihan − bayar − retur; 2F.2)
    tenantQuery<Array<{ totalOutstanding: number; invoiceCount: number }>>(tenantId, async (t) => tp.$queryRaw`
      SELECT
        COALESCE(SUM("grandTotal" - "paidAmount" - "returnedAmount"), 0)::float AS "totalOutstanding",
        COUNT(*)::int AS "invoiceCount"
      FROM "invoices"
      WHERE "tenantId" = ${t}
        AND "status" IN ('ISSUED', 'PARTIAL')
        AND "voidAt" IS NULL
        AND ("grandTotal" - "paidAmount" - "returnedAmount") > 0.01
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

    // 10. Revenue Trend (Last 7 Days) — basis pengiriman, net retur (2F.2)
    tenantQuery<{ date: string; revenue: number }[]>(tenantId, async (t) => tp.$queryRaw`
      SELECT TO_CHAR(("deliveredAt" AT TIME ZONE ${today.timezone})::date, 'YYYY-MM-DD') as "date",
             SUM(GREATEST("grandTotal" - COALESCE("returnedAmount", 0), 0))::float as "revenue"
      FROM "invoices"
      WHERE "tenantId" = ${t}
        AND "deliveredAt" >= ${sevenDayPeriod.start}
        AND "deliveredAt" < ${today.end}
        AND "voidAt" IS NULL
      GROUP BY 1
      ORDER BY "date" ASC
    `),

    // 11. Total Kopi Terjual — ledger FG (SALE_FG_OUT − RETURN_FG_IN), berat per
    //     unit dari resep TERBARU produk; produk tanpa resep tetap dihitung
    //     unitnya (unitsWithoutWeight) dan tidak hilang dari hitungan.
    tp.inventoryLedger.findMany({
      where: {
        refType: { in: ["SALE_FG_OUT", "RETURN_FG_IN"] },
        product: { type: "FINISHED_GOODS" },
      },
      select: { entryType: true, quantityUnit: true, productId: true },
    }),

    // 12. Berat per unit (resep terbaru per produk jadi)
    tp.recipe.findMany({
      where: { product: { type: "FINISHED_GOODS" } },
      select: { productId: true, outputGrams: true },
      orderBy: { createdAt: "desc" },
    }),

    // 13. Average Roast Yield
    tp.parentRoastingBatch.aggregate({
      _avg: { totalShrinkagePercent: true },
      where: { status: "COMPLETED" }
    }),

    // 14. Gross Margin (All time) — hanya nota terkirim & tidak void (2F.2);
    //     diskon header & retur dinetkan proporsional per nota.
    tenantQuery<{ totalRevenue: number, totalCogs: number }[]>(tenantId, async (t) => tp.$queryRaw`
      SELECT 
        COALESCE(SUM(ii."subtotal" * net."netFactor"), 0)::float as "totalRevenue",
        COALESCE(SUM(ii."hpp" * ii."quantity" * net."netFactor"), 0)::float as "totalCogs"
      FROM "invoice_items" ii
      JOIN "invoices" i ON ii."invoiceId" = i.id
      JOIN (
        SELECT id,
          GREATEST("grandTotal" - COALESCE("returnedAmount", 0), 0)
            / NULLIF("subtotal", 0) AS "netFactor"
        FROM "invoices"
      ) net ON net."id" = i.id
      WHERE i."tenantId" = ${t} AND i."deliveredAt" IS NOT NULL AND i."voidAt" IS NULL
    `),

    tp.dailyBriefSnapshot.findFirst({
      orderBy: { reportDate: "desc" },
      select: { payload: true },
    }),

    // 15. Live work queue: PO yang sudah dikirim/diterima sebagian.
    tp.purchaseOrder.count({ where: { status: { in: ["SENT", "PARTIAL"] } } }),

    // 16. Live work queue: batch roasting aktif yang belum mem-posting hasil.
    tp.parentRoastingBatch.count({ where: { status: "PENDING" } }),

    // 17. Live work queue: bukti bayar yang belum membentuk kas.
    tp.paymentSubmission.count({ where: { status: "AWAITING_VERIFICATION" } }),

    // 18. Live work queue: tahap fulfillment yang memerlukan tindakan internal.
    tp.invoice.groupBy({
      by: ["fulfillmentStatus"],
      where: {
        publicOrderToken: { not: null },
        fulfillmentStatus: { in: ["NEEDS_PRODUCTION", "READY_TO_PACK", "PACKED"] },
      },
      _count: true,
    }),

    // 19. Live work queue: hanya piutang yang benar-benar lewat jatuh tempo.
    tp.invoice.aggregate({
      where: { status: { in: ["ISSUED", "PARTIAL"] }, voidAt: null, dueDate: { lt: now } },
      _count: true,
      _sum: { grandTotal: true, paidAmount: true, returnedAmount: true },
    }),

    // 20. Arus kopi 30 hari (kg) untuk mini Sankey Hari Ini.
    tp.inventoryLedger.groupBy({
      by: ["refType"],
      where: {
        refType: { in: ["PURCHASE_GB", "ROASTING_GB_OUT", "ROASTING_RB_IN"] },
        createdAt: { gte: thirtyDayPeriod.start, lt: thirtyDayPeriod.end },
      },
      _sum: { quantityKg: true },
    }),
  ]);

  // ── KPI calculations ──
  // Pendapatan = total tagihan bersih retur untuk nota yang DISERAHKAN
  // (definisi kanonik tunggal di seluruh laporan — lihat src/lib/report-finance.ts).
  const revenueToday = computeRevenue([{
    grandTotal: revenueTodayRaw._sum.grandTotal,
    returnedAmount: revenueTodayRaw._sum.returnedAmount,
  }]);
  const kasToday     = Number(kasTodayRaw._sum.amount ?? 0);
  const totalPiutang = Number(piutangSummary[0]?.totalOutstanding ?? 0);
  const piutangCount = Number(piutangSummary[0]?.invoiceCount ?? 0);

  // Berat per unit: resep TERBARU per produk; produk tanpa resep → grams null.
  const gramsByProduct = new Map<string, number>();
  for (const recipe of productRecipes) {
    if (!gramsByProduct.has(recipe.productId)) {
      gramsByProduct.set(recipe.productId, Number(recipe.outputGrams));
    }
  }
  const { kg: totalKopiTerjual, unitsWithoutWeight: totalSoldUnitsNoWeight } = netSoldKg(
    soldLedgerEntries.map((entry) => ({
      entryType: entry.entryType as "IN" | "OUT",
      quantityUnit: Number(entry.quantityUnit ?? 0),
      outputGrams: gramsByProduct.get(entry.productId as string) ?? null,
    })),
  );
  
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
    Number(overdueReceivables._sum.grandTotal ?? 0)
      - Number(overdueReceivables._sum.paidAmount ?? 0)
      - Number(overdueReceivables._sum.returnedAmount ?? 0),
  );

  // ── Arus kopi 30 hari (kg) ──
  const kgByRef = new Map(
    coffeeFlowMiniRaw.map((row) => [row.refType, Number(row._sum.quantityKg ?? 0)]),
  );
  const miniBeliKg = kgByRef.get("PURCHASE_GB") ?? 0;
  const miniDiRoastKg = kgByRef.get("ROASTING_GB_OUT") ?? 0;
  const miniHasilKg = kgByRef.get("ROASTING_RB_IN") ?? 0;
  const coffeeFlowMini = {
    beliKg: miniBeliKg,
    diRoastKg: miniDiRoastKg,
    susutKg: Math.max(0, Math.round((miniDiRoastKg - miniHasilKg) * 100) / 100),
  };

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
      totalSoldUnitsNoWeight,
      averageRoastYield,
      averageGrossMargin,
    },
    revenueTrend,
    lowStock,
    activity: activities,
    asOf: now.toISOString(),
    dailyBrief: dailyBriefSnapshot?.payload as DailyBriefPayload | null ?? null,
    coffeeFlowMini,
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

export async function getTodayData(): Promise<TodayData> {
  const user = await requireRole("OWNER", "MANAGER", "OPERATOR", "CASHIER");
  const tp = await requireTenantPrisma();
  const now = getCurrentDate();

  const [
    stockProducts,
    stockPackagings,
    purchaseOrdersToReceive,
    roastingBatchesOpen,
    paymentReviews,
    fulfillmentGroups,
    overdueReceivables,
  ] = await Promise.all([
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
    tp.purchaseOrder.count({ where: { status: { in: ["SENT", "PARTIAL"] } } }),
    tp.parentRoastingBatch.count({ where: { status: "PENDING" } }),
    tp.paymentSubmission.count({ where: { status: "AWAITING_VERIFICATION" } }),
    tp.invoice.groupBy({
      by: ["fulfillmentStatus"],
      where: {
        publicOrderToken: { not: null },
        fulfillmentStatus: { in: ["NEEDS_PRODUCTION", "READY_TO_PACK", "PACKED"] },
      },
      _count: true,
    }),
    tp.invoice.aggregate({
      where: { status: { in: ["ISSUED", "PARTIAL"] }, voidAt: null, dueDate: { lt: now } },
      _count: true,
      _sum: { grandTotal: true, paidAmount: true, returnedAmount: true },
    }),
  ]);

  const lowStock: LowStockItem[] = [];
  for (const product of stockProducts) {
    if (!product.reorderAlertEnabled) continue;
    const threshold = Number(product.safetyStockQuantity);
    const usesUnits = product.type === "FINISHED_GOODS";
    const stock = Number(usesUnits ? product.stockUnit : product.stockKg);
    if (stock <= threshold) {
      lowStock.push({
        id: product.id,
        name: product.name,
        type: product.type as LowStockItem["type"],
        stock,
        unit: usesUnits ? "pcs" : "kg",
        threshold,
      });
    }
  }
  for (const packaging of stockPackagings) {
    if (!packaging.reorderAlertEnabled) continue;
    const stock = Number(packaging.stockUnit);
    const threshold = Number(packaging.safetyStockQuantity);
    if (stock <= threshold) {
      lowStock.push({
        id: packaging.id,
        name: packaging.name,
        type: "PACKAGING",
        stock,
        unit: "pcs",
        threshold,
      });
    }
  }

  const fulfillmentCount = new Map(
    fulfillmentGroups.map((row) => [row.fulfillmentStatus, row._count]),
  );
  const overdueTotal = Math.max(
    0,
    Number(overdueReceivables._sum.grandTotal ?? 0)
      - Number(overdueReceivables._sum.paidAmount ?? 0)
      - Number(overdueReceivables._sum.returnedAmount ?? 0),
  );

  return {
    asOf: now.toISOString(),
    role: user.role as TodayData["role"],
    lowStock,
    operationalQueue: {
      purchaseOrdersToReceive,
      roastingBatchesOpen,
      paymentReviews,
      fulfillmentNeedsProduction: fulfillmentCount.get("NEEDS_PRODUCTION") ?? 0,
      fulfillmentReadyToPack: fulfillmentCount.get("READY_TO_PACK") ?? 0,
      fulfillmentPacked: fulfillmentCount.get("PACKED") ?? 0,
      overdueReceivables: {
        count: overdueReceivables._count,
        total: overdueTotal,
      },
    },
  };
}
