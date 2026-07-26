"use server";

import { getPnLReport } from "../keuangan/actions";
import { getSystemUserId, requireFeature, requireTenantPrisma } from "@/lib/auth";
import { getPayableAgingBucket } from "@/lib/purchase-payments";
import { revalidatePath } from "next/cache";
import { getCurrentDate } from "@/lib/date-utils";
import { weightedAverageCost } from "@/lib/financial-reporting";
import { formatRupiah } from "@/lib/format";
import { getRbCostPrioritizingCache, getFgHppPrioritizingCache } from "@/lib/costing";

export type ValuationRow = {
  id: string;
  code: string;
  name: string;
  category: "GREEN_BEAN" | "ROASTED_BEAN" | "FINISHED_GOODS" | "PACKAGING";
  stock: number;
  unit: string;
  unitCost: number;
  totalValue: number;
  retailPrice?: number;
  potentialRevenue?: number;
  sampleWriteOff: number;
};

export type InventoryValuationReport = {
  items: ValuationRow[];
  totalGreenBeanValue: number;
  totalRoastedBeanValue: number;
  totalFinishedGoodsValue: number;
  totalPackagingValue: number;
  grandTotalValue: number;
  totalFinishedGoodsPotentialRevenue: number;
  totalFinishedGoodsMarginHealth: number;
  totalPotentialRevenue: number;
  totalMarginHealth: number;
  asOf: string;
  costMethod: "WEIGHTED_AVERAGE";
  zeroCostItemCount: number;
  totalSampleWriteOff: number;
};

export async function getInventoryValuationReport(asOf = getCurrentDate()): Promise<InventoryValuationReport> {
  await requireFeature("ADVANCED_REPORTS");
  const tp = await requireTenantPrisma();
  const products = await tp.product.findMany({
    where: { isActive: true },
    include: {
      purchases: {
        where: {
          status: { in: ["COMPLETED", "VOID"] },
          receivedAt: { lte: asOf },
          OR: [{ voidAt: null }, { voidAt: { gt: asOf } }],
        },
        select: { weightKg: true, totalCost: true },
      },
      productionBatches: {
        where: {
          status: { in: ["COMPLETED", "VOID"] },
          producedAt: { lte: asOf },
          OR: [{ voidAt: null }, { voidAt: { gt: asOf } }],
        },
        select: { unitsProduced: true, hppPerUnit: true },
      },
      ledgerEntries: {
        where: { createdAt: { lte: asOf } },
        select: { entryType: true, quantityKg: true, quantityUnit: true },
      },
      // Untuk hitung HPP dari resep
      recipes: {
        where: { isActive: true },
        select: {
          packagingId: true,
          items: {
            select: {
              productId: true,
              gramsPerUnit: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  const roasts = await tp.parentRoastingBatch.findMany({
    where: {
      status: { in: ["COMPLETED", "VOID"] },
      AND: [{ OR: [{ voidAt: null }, { voidAt: { gt: asOf } }] }],
      OR: [
        { completedAt: { lte: asOf } },
        { completedAt: null, createdAt: { lte: asOf } },
      ],
    },
    select: {
      inputProductId: true,
      outputProductId: true,
      targetWeightKg: true,
      actualOutputKg: true,
    },
  });

  const greenBeanCost = new Map<string, number>();
  for (const product of products.filter((row) => row.type === "GREEN_BEAN")) {
    greenBeanCost.set(product.id, weightedAverageCost(product.purchases.map((purchase) => ({
      quantity: Number(purchase.weightKg ?? 0),
      totalCost: Number(purchase.totalCost),
    }))));
  }

  const roastedBeanCost = new Map<string, number>();
  for (const product of products.filter((row) => row.type === "ROASTED_BEAN")) {
    const batchesForThisRb = roasts
      .filter((roast) => roast.outputProductId === product.id)
      .map((roast) => ({
        inputProductId: roast.inputProductId,
        targetWeightKg: roast.targetWeightKg,
        actualOutputKg: roast.actualOutputKg,
      }));
    const avgCostDb = Number(product.avgCostPerKg ?? 0);
    roastedBeanCost.set(product.id, getRbCostPrioritizingCache(avgCostDb, batchesForThisRb, greenBeanCost));
  }

  // Fetch packaging data for recipe-based HPP calculation
  const packagingMap = new Map<string, number>();
  const allPackaging = await tp.packaging.findMany({
    select: { id: true, costPerUnit: true },
  });
  for (const pkg of allPackaging) {
    packagingMap.set(pkg.id, Number(pkg.costPerUnit));
  }

  // Compute sample write-off per item from completed samples in the period
  const sampleComponents = await tp.sampleUsageComponent.findMany({
    where: {
      sampleUsage: { status: "COMPLETED", givenAt: { lte: asOf } },
    },
    select: {
      productId: true,
      packagingId: true,
      quantityKg: true,
      quantityUnit: true,
      unitCost: true,
    },
  });

  const sampleWriteOffMap = new Map<string, number>();
  for (const comp of sampleComponents) {
    const key = comp.productId ?? comp.packagingId;
    if (!key) continue;
    const cost = Number(comp.unitCost) * (comp.quantityKg ? Number(comp.quantityKg) : (comp.quantityUnit ?? 0));
    sampleWriteOffMap.set(key, (sampleWriteOffMap.get(key) ?? 0) + cost);
  }

  const items: ValuationRow[] = [];

  for (const p of products) {
    if (p.type === "GREEN_BEAN" || p.type === "ROASTED_BEAN") {
      const stockKg = p.ledgerEntries.reduce((stock, entry) => {
        const quantity = Number(entry.quantityKg ?? 0);
        return stock + (entry.entryType === "IN" ? quantity : -quantity);
      }, 0);
      const unitCost = p.type === "GREEN_BEAN"
        ? greenBeanCost.get(p.id) ?? 0
        : roastedBeanCost.get(p.id) ?? 0;

      if (stockKg > 0.0005) {
        const retailPrice = p.type === "ROASTED_BEAN" ? Number(p.price || 0) : undefined;
        const potentialRevenue = p.type === "ROASTED_BEAN" ? stockKg * (retailPrice || 0) : undefined;

        items.push({
          id: p.id,
          code: p.code,
          name: p.name,
          category: p.type as "GREEN_BEAN" | "ROASTED_BEAN",
          stock: stockKg,
          unit: "kg",
          unitCost,
          totalValue: stockKg * unitCost,
          sampleWriteOff: sampleWriteOffMap.get(p.id) ?? 0,
          ...(p.type === "ROASTED_BEAN" && { retailPrice, potentialRevenue }),
        });
      }
    } else if (p.type === "FINISHED_GOODS") {
      const stockUnit = p.ledgerEntries.reduce((stock, entry) => {
        const quantity = Number(entry.quantityUnit ?? 0);
        return stock + (entry.entryType === "IN" ? quantity : -quantity);
      }, 0);
      // Prioritas: HPP terakhir, lalu HPP dari batch produksi terakhir, lalu fallback ke resep
      const lastHpp = p.avgCostPerKg ? Number(p.avgCostPerKg) : null;
      const lastProductionHpp = p.productionBatches[0]?.hppPerUnit ? Number(p.productionBatches[0].hppPerUnit) : null;
      const recipe = p.recipes?.[0];
      
      const unitCost = getFgHppPrioritizingCache(
        lastHpp,
        lastProductionHpp,
        recipe?.items ?? [],
        recipe?.packagingId,
        roastedBeanCost,
        packagingMap,
        0
      );
      const retailPrice = Number(p.price || 0);
      const potentialRevenue = stockUnit * retailPrice;
      
      if (stockUnit > 0) {
        items.push({
          id: p.id,
          code: p.code,
          name: p.name,
          category: "FINISHED_GOODS",
          stock: stockUnit,
          unit: "pcs",
          unitCost,
          totalValue: stockUnit * unitCost,
          sampleWriteOff: sampleWriteOffMap.get(p.id) ?? 0,
          retailPrice,
          potentialRevenue,
        });
      }
    }
  }

  const packagings = await tp.packaging.findMany({
    where: { isActive: true },
    include: {
      purchases: {
        where: {
          status: { in: ["COMPLETED", "VOID"] },
          receivedAt: { lte: asOf },
          OR: [{ voidAt: null }, { voidAt: { gt: asOf } }],
        },
        select: { quantityUnits: true, totalCost: true },
      },
      ledgerEntries: {
        where: { createdAt: { lte: asOf } },
        select: { entryType: true, quantityUnit: true },
      },
    },
    orderBy: { name: "asc" },
  });

  for (const pkg of packagings) {
    const stockUnit = pkg.ledgerEntries.reduce((stock, entry) => {
      const quantity = Number(entry.quantityUnit ?? 0);
      return stock + (entry.entryType === "IN" ? quantity : -quantity);
    }, 0);

    if (stockUnit > 0) {
      const calculatedCost = weightedAverageCost(pkg.purchases.map((purchase) => ({
        quantity: Number(purchase.quantityUnits ?? 0),
        totalCost: Number(purchase.totalCost),
      })));
      const unitCost = calculatedCost || Number(pkg.costPerUnit);
      items.push({
        id: pkg.id,
        code: pkg.code,
        name: pkg.name,
        category: "PACKAGING",
        stock: stockUnit,
        unit: "pcs",
        unitCost,
        totalValue: stockUnit * unitCost,
        sampleWriteOff: sampleWriteOffMap.get(pkg.id) ?? 0,
      });
    }
  }

  const totalGreenBeanValue = items.filter((i) => i.category === "GREEN_BEAN").reduce((s, i) => s + i.totalValue, 0);
  const totalRoastedBeanValue = items.filter((i) => i.category === "ROASTED_BEAN").reduce((s, i) => s + i.totalValue, 0);
  const totalFinishedGoodsValue = items.filter((i) => i.category === "FINISHED_GOODS").reduce((s, i) => s + i.totalValue, 0);
  const totalPackagingValue = items.filter((i) => i.category === "PACKAGING").reduce((s, i) => s + i.totalValue, 0);
  const grandTotalValue = totalGreenBeanValue + totalRoastedBeanValue + totalFinishedGoodsValue + totalPackagingValue;

  const retailFgItems = items.filter((i) => i.category === "FINISHED_GOODS" && i.potentialRevenue && i.potentialRevenue > 0);
  const totalFinishedGoodsPotentialRevenue = retailFgItems.reduce((s, i) => s + (i.potentialRevenue || 0), 0);
  const retailFgValueOnly = retailFgItems.reduce((s, i) => s + i.totalValue, 0);
  
  const fgGrossMargin = totalFinishedGoodsPotentialRevenue - retailFgValueOnly;
  const totalFinishedGoodsMarginHealth = totalFinishedGoodsPotentialRevenue > 0 ? (fgGrossMargin / totalFinishedGoodsPotentialRevenue) * 100 : 0;

  const retailItems = items.filter((i) => i.potentialRevenue && i.potentialRevenue > 0);
  const totalPotentialRevenue = retailItems.reduce((s, i) => s + (i.potentialRevenue || 0), 0);
  
  const retailFgValue = retailItems.filter((i) => i.category === "FINISHED_GOODS").reduce((s, i) => s + i.totalValue, 0);
  const retailRbValue = retailItems.filter((i) => i.category === "ROASTED_BEAN").reduce((s, i) => s + i.totalValue, 0);
  
  const totalGrossMargin = totalPotentialRevenue - (retailFgValue + retailRbValue);
  const totalMarginHealth = totalPotentialRevenue > 0 ? (totalGrossMargin / totalPotentialRevenue) * 100 : 0;
  const totalSampleWriteOff = items.reduce((s, i) => s + i.sampleWriteOff, 0);

  return {
    items,
    totalGreenBeanValue,
    totalRoastedBeanValue,
    totalFinishedGoodsValue,
    totalPackagingValue,
    grandTotalValue,
    totalFinishedGoodsPotentialRevenue,
    totalFinishedGoodsMarginHealth,
    totalPotentialRevenue,
    totalMarginHealth,
    asOf: asOf.toISOString(),
    costMethod: "WEIGHTED_AVERAGE",
    zeroCostItemCount: items.filter((item) => item.unitCost <= 0).length,
    totalSampleWriteOff,
  };
}

// =============================================================================
// BALANCE SHEET (NERACA)
// =============================================================================

export type BalanceSheetReport = {
  asOf: string;
  status: "DRAFT";
  warnings: string[];
  assets: {
    cashAndBank: number;
    accountsReceivable: number;
    inventory: number;
    totalAssets: number;
  };
  liabilities: {
    accountsPayable: number;
    totalLiabilities: number;
    aging: {
      current: number;
      overdue1To30: number;
      overdue31To60: number;
      overdue61Plus: number;
    };
    trackingNote: string;
  };
  equity: {
    contributedCapital: number;
    retainedEarnings: number;
    distributedProfit: number;
    totalEquity: number;
  };
};

export async function getBalanceSheetReport(
  inventoryValue?: number,
  asOf = getCurrentDate(),
): Promise<BalanceSheetReport> {
  await requireFeature("ADVANCED_REPORTS");
  const tp = await requireTenantPrisma();
  const [customerPayments, expenses, supplierPayments] = await Promise.all([
    tp.payment.aggregate({
      where: {
        paidAt: { lte: asOf },
        OR: [{ voidAt: null }, { voidAt: { gt: asOf } }],
      },
      _sum: { amount: true },
    }),
    tp.expense.aggregate({
      where: {
        date: { lte: asOf },
        OR: [{ voidAt: null }, { voidAt: { gt: asOf } }],
      },
      _sum: { amount: true },
    }),
    tp.supplierPayment.aggregate({
      where: {
        paidAt: { lte: asOf },
        OR: [{ voidAt: null }, { voidAt: { gt: asOf } }],
      },
      _sum: { amount: true },
    }),
  ]);

  const totalInjected = 0;
  const totalWithdrawn = 0;
  const totalDistributed = 0;

  const cashIn = Number(customerPayments._sum.amount) || 0;
  const cashOut = (Number(expenses._sum.amount) || 0) + (Number(supplierPayments._sum.amount) || 0);
  
  // Kas = Uang Masuk Penjualan - Uang Keluar Operasional + Suntikan Modal - Penarikan Prive - Bagi Hasil
  const cashAndBank = cashIn - cashOut + totalInjected - totalWithdrawn - totalDistributed;

  // Accounts Receivable (Piutang)
  const piutangInvoices = await tp.invoice.findMany({
    where: {
      status: { not: "DRAFT" },
      issuedAt: { lte: asOf },
      OR: [{ voidAt: null }, { voidAt: { gt: asOf } }],
    },
    select: {
      grandTotal: true,
      payments: {
        where: {
          paidAt: { lte: asOf },
          OR: [{ voidAt: null }, { voidAt: { gt: asOf } }],
        },
        select: { amount: true },
      },
    },
  });
  const accountsReceivable = piutangInvoices.reduce((sum, invoice) => {
    const paid = invoice.payments.reduce((paymentSum, payment) => paymentSum + Number(payment.amount), 0);
    return sum + Math.max(0, Number(invoice.grandTotal) - paid);
  }, 0);

  // Inventory
  let inventory = inventoryValue || 0;
  if (inventoryValue === undefined) {
    const inventoryReport = await getInventoryValuationReport(asOf);
    inventory = inventoryReport.grandTotalValue;
  }

  const totalAssets = cashAndBank + accountsReceivable + inventory;

  const payablePurchases = await tp.purchase.findMany({
    where: {
      status: { in: ["COMPLETED", "VOID"] },
      receivedAt: { lte: asOf },
      OR: [{ voidAt: null }, { voidAt: { gt: asOf } }],
    },
    select: {
      totalCost: true,
      dueDate: true,
      payments: {
        where: {
          paidAt: { lte: asOf },
          OR: [{ voidAt: null }, { voidAt: { gt: asOf } }],
        },
        select: { amount: true },
      },
    },
  });
  const aging = {
    current: 0,
    overdue1To30: 0,
    overdue31To60: 0,
    overdue61Plus: 0,
  };
  let unpaidCount = 0;
  for (const purchase of payablePurchases) {
    const paid = purchase.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const balance = Math.max(0, Number(purchase.totalCost) - paid);
    if (balance <= 0.01) continue;
    unpaidCount++;
    const bucket = getPayableAgingBucket(purchase.dueDate, asOf);
    if (bucket === "CURRENT") aging.current += balance;
    if (bucket === "OVERDUE_1_30") aging.overdue1To30 += balance;
    if (bucket === "OVERDUE_31_60") aging.overdue31To60 += balance;
    if (bucket === "OVERDUE_61_PLUS") aging.overdue61Plus += balance;
  }
  const accountsPayable =
    aging.current + aging.overdue1To30 + aging.overdue31To60 + aging.overdue61Plus;
  const totalLiabilities = accountsPayable;

  // Equity
  const totalEquity = totalAssets - totalLiabilities;
  const contributedCapital = totalInjected - totalWithdrawn;
  const retainedEarnings = totalEquity - contributedCapital;

  return {
    asOf: asOf.toISOString(),
    status: "DRAFT",
    warnings: [
      "Modal pemilik, aset tetap, pinjaman bank, dan pajak belum memiliki subledger khusus; ekuitas masih dihitung sebagai nilai residual.",
      "Kas & bank adalah estimasi arus transaksi tercatat dan belum direkonsiliasi dengan rekening bank fisik.",
    ],
    assets: {
      cashAndBank,
      accountsReceivable,
      inventory,
      totalAssets
    },
    liabilities: {
      accountsPayable,
      totalLiabilities,
      aging,
      trackingNote: unpaidCount > 0
        ? `${unpaidCount} dari ${payablePurchases.length} pembelian supplier masih memiliki saldo hutang.`
        : "Semua pembelian supplier sudah lunas.",
    },
    equity: {
      contributedCapital,
      retainedEarnings,
      distributedProfit: totalDistributed,
      totalEquity
    }
  };
}



export type GreenBeanFlow = {
  id: string;
  name: string;
  boughtKg: number;
  roastedKg: number;
  adjustmentOutKg: number;
  currentStockKg: number;
  avgPurchasePrice: number;
};

export type RoastedBeanFlow = {
  id: string;
  name: string;
  producedKg: number;
  roastLossKg: number;
  packagedKg: number;
  adjustmentOutKg: number;
  sampleOutKg: number;
  currentStockKg: number;
  roastLossValue: number;
};

export type FinishedGoodsFlow = {
  id: string;
  name: string;
  producedUnits: number;
  soldUnits: number;
  adjustmentOutUnits: number;
  sampleOutUnits: number;
  currentStockUnits: number;
  weightPerUnitGrams: number;
  soldEquivalentKg: number;
  producedEquivalentKg: number;
  salesRevenue: number;
  cogs: number;
  grossProfit: number;
};

export type CoffeeFlowReport = {
  greenBeans: GreenBeanFlow[];
  roastedBeans: RoastedBeanFlow[];
  finishedGoods: FinishedGoodsFlow[];
  periodStart: string | null;
  periodEnd: string;
};

export async function getCoffeeFlowReport(
  periodStart?: Date,
  periodEnd = getCurrentDate(),
): Promise<CoffeeFlowReport> {
  await requireFeature("ADVANCED_REPORTS");
  const tp = await requireTenantPrisma();
  const products = await tp.product.findMany({
    where: { isActive: true },
    include: {
      ledgerEntries: { 
        where: { 
          createdAt: { 
            lt: periodEnd,
            ...(periodStart ? { gte: periodStart } : {})
          } 
        } 
      },
      recipes: true,
      purchases: { 
        where: { 
          status: "COMPLETED", 
          receivedAt: { 
            lt: periodEnd,
            ...(periodStart ? { gte: periodStart } : {})
          } 
        } 
      },
      invoiceItems: { 
        where: {
          invoice: {
            issuedAt: {
              lt: periodEnd,
              ...(periodStart ? { gte: periodStart } : {})
            }
          }
        },
        include: { invoice: { select: { status: true, issuedAt: true } } } 
      },
      productionBatches: {
        where: { status: "COMPLETED" },
        orderBy: { producedAt: "desc" },
        take: 1
      }
    }
  });
  const activeSampleIds = new Set((await tp.sampleUsage.findMany({
    where: { status: "COMPLETED", givenAt: { lt: periodEnd, ...(periodStart ? { gte: periodStart } : {}) } },
    select: { id: true },
  })).map((sample) => sample.id));

  const greenBeans: GreenBeanFlow[] = [];
  const roastedBeans: RoastedBeanFlow[] = [];
  const finishedGoods: FinishedGoodsFlow[] = [];
  const inPeriod = (date: Date) => !periodStart || date >= periodStart;

  // Fetch dependencies
  const roastingBatches = await tp.parentRoastingBatch.findMany({
    where: { status: "COMPLETED", createdAt: { lt: periodEnd, ...(periodStart ? { gte: periodStart } : {}) } },
    select: { outputProductId: true, inputProductId: true, targetWeightKg: true, actualOutputKg: true },
  });

  const allPackaging = await tp.packaging.findMany({ select: { id: true, costPerUnit: true } });
  const packagingCostMap = new Map<string, number>();
  for (const pkg of allPackaging) packagingCostMap.set(pkg.id, Number(pkg.costPerUnit));

  // Compute greenBeanCostMap
  const greenBeanCostMap = new Map<string, number>();
  for (const p of products) {
    if (p.type === "GREEN_BEAN") {
      let totalPurCost = 0; let totalPurKg = 0;
      for (const pur of p.purchases) {
        totalPurCost += Number(pur.totalCost);
        totalPurKg += Number(pur.weightKg);
      }
      greenBeanCostMap.set(p.id, totalPurKg > 0 ? totalPurCost / totalPurKg : 0);
    }
  }

  // Compute roastedBeanCostMap
  const roastedBeanCostMap = new Map<string, number>();
  for (const p of products) {
    if (p.type === "ROASTED_BEAN") {
      const batchesForThisRb = roastingBatches
        .filter((roast) => roast.outputProductId === p.id)
        .map((roast) => ({
          inputProductId: roast.inputProductId,
          targetWeightKg: roast.targetWeightKg,
          actualOutputKg: roast.actualOutputKg,
        }));
      const avgCostDb = Number(p.avgCostPerKg ?? 0);
      roastedBeanCostMap.set(p.id, getRbCostPrioritizingCache(avgCostDb, batchesForThisRb, greenBeanCostMap));
    }
  }

  // Compute recipeHppMap
  const recipeHppMap = new Map<string, number>();
  for (const p of products) {
    if (p.type === "FINISHED_GOODS" && p.recipes.length > 0) {
      const lastHpp = p.avgCostPerKg ? Number(p.avgCostPerKg) : null;
      const lastProductionHpp = p.productionBatches[0]?.hppPerUnit ? Number(p.productionBatches[0].hppPerUnit) : null;
      const recipe = p.recipes[0];
      
      const cost = getFgHppPrioritizingCache(
        lastHpp,
        lastProductionHpp,
        (recipe as any).items ?? [],
        recipe.packagingId,
        roastedBeanCostMap,
        packagingCostMap,
        0
      );
      if (cost > 0) recipeHppMap.set(p.id, cost);
    }
  }

  for (const p of products) {
    if (p.type === "GREEN_BEAN") {
      let bought = 0, roasted = 0, adjOut = 0, stock = 0;
      for (const l of p.ledgerEntries) {
        const qty = Number(l.quantityKg || 0);
        if (l.entryType === "IN") stock += qty; else stock -= qty;
        if (!inPeriod(l.createdAt)) continue;
        if (l.refType === "PURCHASE_GB" && l.entryType === "IN") bought += qty;
        if (l.refType === "ROASTING_GB_OUT" && l.entryType === "OUT") roasted += qty;
        if (l.refType === "ADJUSTMENT_OUT" && l.entryType === "OUT") adjOut += qty;
      }
      
      let totalPurCost = 0; let totalPurKg = 0;
      for (const pur of p.purchases) {
        totalPurCost += Number(pur.totalCost);
        totalPurKg += Number(pur.weightKg);
      }
      const avgPurchasePrice = totalPurKg > 0 ? totalPurCost / totalPurKg : 0;

      greenBeans.push({
        id: p.id, name: p.name, boughtKg: bought, roastedKg: roasted, adjustmentOutKg: adjOut, currentStockKg: stock,
        avgPurchasePrice
      });
    } else if (p.type === "ROASTED_BEAN") {
      let produced = 0, packaged = 0, adjOut = 0, sampleOut = 0, stock = 0;
      for (const l of p.ledgerEntries) {
        const qty = Number(l.quantityKg || 0);
        if (l.entryType === "IN") stock += qty; else stock -= qty;
        if (!inPeriod(l.createdAt)) continue;
        if (l.refType === "ROASTING_RB_IN" && l.entryType === "IN") produced += qty;
        if (l.refType === "PRODUCTION_RB_OUT" && l.entryType === "OUT") packaged += qty;
        if (l.refType === "ADJUSTMENT_OUT" && l.entryType === "OUT") adjOut += qty;
        if (l.refType === "SAMPLE_RB_OUT" && l.entryType === "OUT" && activeSampleIds.has(l.refId)) sampleOut += qty;
      }
      
      roastedBeans.push({
        id: p.id, name: p.name, producedKg: produced, roastLossKg: 0, packagedKg: packaged, adjustmentOutKg: adjOut, sampleOutKg: sampleOut, currentStockKg: stock,
        roastLossValue: 0
      });
    } else if (p.type === "FINISHED_GOODS") {
      let producedU = 0, soldU = 0, adjOutU = 0, sampleOutU = 0, stockU = 0;
      for (const l of p.ledgerEntries) {
        const qty = Number(l.quantityUnit || 0);
        if (l.entryType === "IN") stockU += qty; else stockU -= qty;
        if (!inPeriod(l.createdAt)) continue;
        if (l.refType === "PRODUCTION_FG_IN" && l.entryType === "IN") producedU += qty;
        if (l.refType === "SALE_FG_OUT" && l.entryType === "OUT") soldU += qty;
        if (l.refType === "ADJUSTMENT_OUT" && l.entryType === "OUT") adjOutU += qty;
        if (l.refType === "SAMPLE_FG_OUT" && l.entryType === "OUT" && activeSampleIds.has(l.refId)) sampleOutU += qty;
      }
      
      let salesRevenue = 0;
      let cogs = 0;
      // Gunakan HPP dari resep, bukan dari invoice
      const hppPerUnit = recipeHppMap.get(p.id) ?? 0;
      for (const inv of p.invoiceItems) {
        if (
          (inv.invoice.status === "PAID" || inv.invoice.status === "PARTIAL" || inv.invoice.status === "ISSUED")
          && inv.invoice.issuedAt < periodEnd
          && inPeriod(inv.invoice.issuedAt)
        ) {
          salesRevenue += Number(inv.subtotal);
          cogs += hppPerUnit * inv.quantity;
        }
      }
      const grossProfit = salesRevenue - cogs;

      const weightGrams = p.recipes.length > 0 ? Number(p.recipes[0].outputGrams) : 0;
      finishedGoods.push({
        id: p.id, name: p.name, producedUnits: producedU, soldUnits: soldU, adjustmentOutUnits: adjOutU, sampleOutUnits: sampleOutU, currentStockUnits: stockU,
        weightPerUnitGrams: weightGrams,
        soldEquivalentKg: (soldU * weightGrams) / 1000,
        producedEquivalentKg: (producedU * weightGrams) / 1000,
        salesRevenue, cogs, grossProfit
      });
    }
  }


  
  for (const rb of roastedBeans) {
    const batches = roastingBatches.filter(b => b.outputProductId === rb.id);
    let totalInput = 0;
    let totalOutput = 0;
    let totalLossValue = 0;
    for (const b of batches) {
      const inW = Number(b.targetWeightKg);
      const outW = Number(b.actualOutputKg);
      totalInput += inW;
      totalOutput += outW;
      const lossKg = inW - outW;
      const gbPrice = greenBeans.find(gb => gb.id === b.inputProductId)?.avgPurchasePrice || 0;
      totalLossValue += lossKg * gbPrice;
    }
    rb.roastLossKg = totalInput - totalOutput;
    rb.roastLossValue = totalLossValue;
  }

  return {
    greenBeans,
    roastedBeans,
    finishedGoods,
    periodStart: periodStart?.toISOString() ?? null,
    periodEnd: periodEnd.toISOString(),
  };
}

// =============================================================================
// SAMPLE USAGE REPORT
// =============================================================================

export type SampleReport = {
  totalSamples: number;
  totalCost: number;
  totalGrams: number;
  bySourceType: { source: string; count: number; cost: number; grams: number }[];
  byProduct: { productName: string; quantityKg: number; quantityUnit: number; cost: number }[];
  topRecipients: { recipient: string; count: number; cost: number }[];
  monthlyTrend: { month: string; count: number; cost: number }[];
};

export async function getSampleReport(
  periodStart?: Date,
  periodEnd = getCurrentDate(),
): Promise<SampleReport> {
  await requireFeature("ADVANCED_REPORTS");
  const tp = await requireTenantPrisma();

  const samples = await tp.sampleUsage.findMany({
    where: {
      status: "COMPLETED",
      givenAt: { lt: periodEnd, ...(periodStart ? { gte: periodStart } : {}) },
    },
    select: {
      id: true,
      sourceType: true,
      sourceLabel: true,
      packCount: true,
      totalGrams: true,
      totalCost: true,
      recipient: true,
      givenAt: true,
      components: {
        select: {
          label: true,
          quantityKg: true,
          quantityUnit: true,
          unitCost: true,
          totalCost: true,
          product: { select: { name: true, type: true } },
          packaging: { select: { name: true } },
        },
      },
    },
    orderBy: { givenAt: "desc" },
  });

  // Aggregate by source type
  const sourceTypeMap = new Map<string, { count: number; cost: number; grams: number }>();
  for (const s of samples) {
    const key = s.sourceType;
    const entry = sourceTypeMap.get(key) ?? { count: 0, cost: 0, grams: 0 };
    entry.count += s.packCount;
    entry.cost += Number(s.totalCost);
    entry.grams += Number(s.totalGrams);
    sourceTypeMap.set(key, entry);
  }
  const bySourceType = Array.from(sourceTypeMap.entries()).map(([source, data]) => ({
    source,
    ...data,
  }));

  // Aggregate by product
  const productMap = new Map<string, { quantityKg: number; quantityUnit: number; cost: number }>();
  for (const s of samples) {
    for (const comp of s.components) {
      const name = comp.product?.name ?? comp.packaging?.name ?? comp.label;
      const entry = productMap.get(name) ?? { quantityKg: 0, quantityUnit: 0, cost: 0 };
      entry.quantityKg += comp.quantityKg ? Number(comp.quantityKg) : 0;
      entry.quantityUnit += comp.quantityUnit ?? 0;
      entry.cost += Number(comp.totalCost);
      productMap.set(name, entry);
    }
  }
  const byProduct = Array.from(productMap.entries())
    .map(([productName, data]) => ({ productName, ...data }))
    .sort((a, b) => b.cost - a.cost);

  // Top recipients
  const recipientMap = new Map<string, { count: number; cost: number }>();
  for (const s of samples) {
    const name = s.recipient?.trim() || "Tidak disebutkan";
    const entry = recipientMap.get(name) ?? { count: 0, cost: 0 };
    entry.count += 1;
    entry.cost += Number(s.totalCost);
    recipientMap.set(name, entry);
  }
  const topRecipients = Array.from(recipientMap.entries())
    .map(([recipient, data]) => ({ recipient, ...data }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 20);

  // Monthly trend (last 6 months)
  const monthlyTrend: { month: string; count: number; cost: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const label = new Intl.DateTimeFormat("id-ID", { month: "short", year: "2-digit" }).format(d);
    const monthSamples = samples.filter(
      (s) => s.givenAt >= d && s.givenAt < nextMonth,
    );
    monthlyTrend.push({
      month: label,
      count: monthSamples.reduce((sum, s) => sum + s.packCount, 0),
      cost: monthSamples.reduce((sum, s) => sum + Number(s.totalCost), 0),
    });
  }

  return {
    totalSamples: samples.length,
    totalCost: samples.reduce((sum, s) => sum + Number(s.totalCost), 0),
    totalGrams: samples.reduce((sum, s) => sum + Number(s.totalGrams), 0),
    bySourceType,
    byProduct,
    topRecipients,
    monthlyTrend,
  };
}

// =============================================================================
// SALES REPORT
// =============================================================================

export type SalesReportData = {
  totalRevenue: number;
  invoiceCount: number;
  avgInvoice: number;
  topCustomer: string;
  revenueTrend: { date: string; revenue: number }[];
  salesByProduct: { name: string; value: number }[];
  invoices: {
    id: string;
    code: string;
    date: string;
    customer: string;
    amount: number;
    status: string;
  }[];
};

export async function getSalesReport(startDate: string, endDate: string): Promise<SalesReportData> {
  await requireFeature("ADVANCED_REPORTS");
  const tp = await requireTenantPrisma();

  const invoices = await tp.invoice.findMany({
    where: {
      issuedAt: { gte: new Date(startDate), lte: new Date(endDate) },
      status: { in: ["PAID", "ISSUED", "PARTIAL"] },
    },
    include: {
      customer: { select: { name: true } },
      items: { include: { product: { select: { name: true, category: true } } } },
    },
    orderBy: { issuedAt: "desc" },
  });

  const totalRevenue = invoices
    .filter((i) => i.status === "PAID")
    .reduce((sum, i) => sum + Number(i.grandTotal), 0);

  const invoiceCount = invoices.length;
  const avgInvoice = invoiceCount > 0 ? totalRevenue / invoiceCount : 0;

  // Top customer
  const customerMap = new Map<string, number>();
  invoices.forEach((i) => {
    const name = i.customer.name;
    customerMap.set(name, (customerMap.get(name) || 0) + Number(i.grandTotal));
  });
  const topCustomer = Array.from(customerMap.entries())
    .sort((a, b) => b[1] - a[1])[0]?.[0] || "-";

  // Revenue trend (based on date range)
  const revenueTrend: { date: string; revenue: number }[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const chartDays = Math.min(daysDiff + 1, 30); // Cap at 30 days

  for (let i = chartDays - 1; i >= 0; i--) {
    const d = new Date(start);
    d.setDate(d.getDate() + (chartDays - 1 - i));
    const dayStr = d.toISOString().split("T")[0];
    const dayInvoices = invoices.filter(
      (inv) => inv.issuedAt.toISOString().split("T")[0] === dayStr && inv.status === "PAID"
    );
    revenueTrend.push({
      date: new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(d),
      revenue: dayInvoices.reduce((sum, inv) => sum + Number(inv.grandTotal), 0),
    });
  }

  // Sales by product category
  const productMap = new Map<string, number>();
  invoices.forEach((i) => {
    i.items.forEach((item) => {
      const cat = item.product?.category || "OTHER";
      productMap.set(cat, (productMap.get(cat) || 0) + Number(item.hpp || 0) * item.quantity);
    });
  });
  const salesByProduct = Array.from(productMap.entries()).map(([name, value]) => ({ name, value }));

  return {
    totalRevenue,
    invoiceCount,
    avgInvoice,
    topCustomer,
    revenueTrend,
    salesByProduct,
    invoices: invoices.map((i) => ({
      id: i.id,
      code: i.code,
      date: i.issuedAt.toISOString(),
      customer: i.customer.name,
      amount: Number(i.grandTotal),
      status: i.status,
    })),
  };
}

// =============================================================================
// EXPENSE REPORT
// =============================================================================

export type ExpenseReportData = {
  totalExpenses: number;
  totalPurchases: number;
  outstandingPayable: number;
  profit: number;
  expenseTrend: { date: string; expenses: number }[];
  expensesByCategory: { name: string; value: number }[];
  expenses: {
    id: string;
    date: string;
    category: string;
    description: string;
    amount: number;
    status: string;
  }[];
};

export async function getExpenseReport(startDate: string, endDate: string): Promise<ExpenseReportData> {
  await requireFeature("ADVANCED_REPORTS");
  const tp = await requireTenantPrisma();

  const [expenses, purchases, payments] = await Promise.all([
    tp.expense.findMany({
      where: { date: { gte: new Date(startDate), lte: new Date(endDate) } },
      orderBy: { date: "desc" },
    }),
    tp.purchase.findMany({
      where: {
        receivedAt: { gte: new Date(startDate), lte: new Date(endDate) },
        status: { in: ["COMPLETED", "VOID"] },
        OR: [{ voidAt: null }, { voidAt: { gt: new Date(endDate) } }],
      },
    }),
    tp.supplierPayment.findMany({
      where: { paidAt: { gte: new Date(startDate), lte: new Date(endDate) } },
    }),
  ]);

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalPurchases = purchases.reduce((sum, p) => sum + Number(p.totalCost), 0);
  const totalPayments = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const outstandingPayable = totalPurchases - totalPayments;

  // Get revenue for profit calculation
  const invoices = await tp.invoice.findMany({
    where: {
      issuedAt: { gte: new Date(startDate), lte: new Date(endDate) },
      status: "PAID",
    },
  });
  const totalRevenue = invoices.reduce((sum, i) => sum + Number(i.grandTotal), 0);
  const profit = totalRevenue - totalExpenses - totalPurchases;

  // Expense trend (last 7 days)
  const expenseTrend: { date: string; expenses: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().split("T")[0];
    const dayExpenses = expenses.filter(
      (e) => e.date.toISOString().split("T")[0] === dayStr
    );
    expenseTrend.push({
      date: new Intl.DateTimeFormat("id-ID", { weekday: "short" }).format(d),
      expenses: dayExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
    });
  }

  // Expenses by category
  const categoryMap = new Map<string, number>();
  expenses.forEach((e) => {
    categoryMap.set(e.category, (categoryMap.get(e.category) || 0) + Number(e.amount));
  });
  const expensesByCategory = Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value }));

  return {
    totalExpenses,
    totalPurchases,
    outstandingPayable,
    profit,
    expenseTrend,
    expensesByCategory,
    expenses: expenses.map((e) => ({
      id: e.id,
      date: e.date.toISOString(),
      category: e.category,
      description: e.description || "-",
      amount: Number(e.amount),
      status: "Lunas",
    })),
  };
}

// =============================================================================
// ROASTING REPORT
// =============================================================================

export type RoastingReportData = {
  totalBatches: number;
  totalGbUsed: number;
  totalRbProduced: number;
  avgYield: number;
  lossPercent: number;
  yieldTrend: { date: string; yield: number }[];
  batches: {
    id: string;
    date: string;
    gbInput: number;
    rbOutput: number;
    yield: number;
    machine: string;
  }[];
};

export async function getRoastingReport(startDate: string, endDate: string): Promise<RoastingReportData> {
  await requireFeature("ADVANCED_REPORTS");
  const tp = await requireTenantPrisma();

  const batches = await tp.parentRoastingBatch.findMany({
    where: {
      completedAt: { gte: new Date(startDate), lte: new Date(endDate) },
      status: { in: ["COMPLETED", "VOID"] },
      OR: [{ voidAt: null }, { voidAt: { gt: new Date(endDate) } }],
    },
    include: {
      inputProduct: { select: { name: true } },
      outputProduct: { select: { name: true } },
    },
    orderBy: { completedAt: "desc" },
  });

  // Fetch machine names separately
  const machineIds = batches.map((b) => b.machineId).filter((id): id is string => id !== null);
  const machines = await tp.machine.findMany({
    where: { id: { in: machineIds } },
    select: { id: true, name: true },
  });
  const machineMap = new Map(machines.map((m) => [m.id, m.name]));

  const totalBatches = batches.length;
  const totalGbUsed = batches.reduce((sum, b) => sum + Number(b.targetWeightKg), 0);
  const totalRbProduced = batches.reduce((sum, b) => sum + Number(b.actualOutputKg || 0), 0);
  const avgYield = totalGbUsed > 0 ? (totalRbProduced / totalGbUsed) * 100 : 0;
  const lossPercent = 100 - avgYield;

  // Yield trend (last 7 days)
  const yieldTrend: { date: string; yield: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().split("T")[0];
    const dayBatches = batches.filter(
      (b) => b.completedAt?.toISOString().split("T")[0] === dayStr
    );
    const dayGb = dayBatches.reduce((sum, b) => sum + Number(b.targetWeightKg), 0);
    const dayRb = dayBatches.reduce((sum, b) => sum + Number(b.actualOutputKg || 0), 0);
    yieldTrend.push({
      date: new Intl.DateTimeFormat("id-ID", { weekday: "short" }).format(d),
      yield: dayGb > 0 ? (dayRb / dayGb) * 100 : 0,
    });
  }

  return {
    totalBatches,
    totalGbUsed,
    totalRbProduced,
    avgYield,
    lossPercent,
    yieldTrend,
    batches: batches.map((b) => ({
      id: b.id,
      date: (b.completedAt || b.createdAt).toISOString(),
      gbInput: Number(b.targetWeightKg),
      rbOutput: Number(b.actualOutputKg || 0),
      yield: Number(b.targetWeightKg) > 0
        ? (Number(b.actualOutputKg || 0) / Number(b.targetWeightKg)) * 100
        : 0,
      machine: b.machineId ? (machineMap.get(b.machineId) || "-") : "-",
    })),
  };
}

// =============================================================================
// PRODUCTION REPORT
// =============================================================================

export type ProductionReportData = {
  totalBatches: number;
  totalRbUsed: number;
  totalFgProduced: number;
  totalPackagingUsed: number;
  efficiency: number;
  productionTrend: { date: string; units: number }[];
  batches: {
    id: string;
    date: string;
    sku: string;
    rbUsed: number;
    fgOutput: number;
    recipe: string;
    status: string;
  }[];
};

export async function getProductionReport(startDate: string, endDate: string): Promise<ProductionReportData> {
  await requireFeature("ADVANCED_REPORTS");
  const tp = await requireTenantPrisma();

  const batches = await tp.productionBatch.findMany({
    where: {
      producedAt: { gte: new Date(startDate), lte: new Date(endDate) },
      status: { in: ["COMPLETED", "VOID"] },
      OR: [{ voidAt: null }, { voidAt: { gt: new Date(endDate) } }],
    },
    include: {
      outputProduct: { select: { name: true } },
      recipe: { select: { name: true } },
    },
    orderBy: { producedAt: "desc" },
  });

  const totalBatches = batches.length;
  const totalRbUsed = batches.reduce((sum, b) => sum + Number(b.totalRbUsedKg), 0);
  const totalFgProduced = batches.reduce((sum, b) => sum + b.unitsProduced, 0);
  const totalPackagingUsed = batches.reduce((sum, b) => sum + b.unitsProduced, 0); // 1:1 with FG
  const efficiency = totalRbUsed > 0 ? (totalFgProduced / totalRbUsed) * 100 : 0;

  // Production trend (last 7 days)
  const productionTrend: { date: string; units: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().split("T")[0];
    const dayBatches = batches.filter(
      (b) => b.producedAt?.toISOString().split("T")[0] === dayStr
    );
    productionTrend.push({
      date: new Intl.DateTimeFormat("id-ID", { weekday: "short" }).format(d),
      units: dayBatches.reduce((sum, b) => sum + b.unitsProduced, 0),
    });
  }

  return {
    totalBatches,
    totalRbUsed,
    totalFgProduced,
    totalPackagingUsed,
    efficiency,
    productionTrend,
    batches: batches.map((b) => ({
      id: b.id,
      date: (b.producedAt || b.createdAt).toISOString(),
      sku: b.outputProduct?.name || "-",
      rbUsed: Number(b.totalRbUsedKg),
      fgOutput: b.unitsProduced,
      recipe: b.recipe?.name || "-",
      status: b.status,
    })),
  };
}

// =============================================================================
// SUMMARY REPORT
// =============================================================================

export type SummaryReportData = {
  revenue: number;
  expenses: number;
  profit: number;
  stockValue: number;
  revenueTrend: number;
  expensesTrend: number;
  profitTrend: number;
  stockTrend: number;
  revenueChart: { date: string; value: number }[];
  pipeline: { label: string; value: string; status: string }[];
};

export async function getSummaryReport(startDate?: string, endDate?: string): Promise<SummaryReportData> {
  await requireFeature("ADVANCED_REPORTS");

  const now = new Date();
  const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = endDate ? new Date(endDate) : now;

  const [currentPnl, lastPnl, inventory] = await Promise.all([
    getPnLReport(now.getMonth() + 1, now.getFullYear()),
    getPnLReport(now.getMonth(), now.getFullYear()),
    getInventoryValuationReport(),
  ]);

  const revenue = currentPnl.netSales;
  const expenses = currentPnl.opex;
  const profit = currentPnl.netProfit;
  const stockValue = inventory.grandTotalValue;

  const lastRevenue = lastPnl.netSales;
  const lastExpenses = lastPnl.opex;
  const lastProfit = lastPnl.netProfit;

  const revenueTrend = lastRevenue > 0 ? ((revenue - lastRevenue) / lastRevenue) * 100 : 0;
  const expensesTrend = lastExpenses > 0 ? ((expenses - lastExpenses) / lastExpenses) * 100 : 0;
  const profitTrend = lastProfit > 0 ? ((profit - lastProfit) / lastProfit) * 100 : 0;

  // Revenue chart (based on date range or last 7 days)
  const revenueChart: { date: string; value: number }[] = [];
  const tp = await requireTenantPrisma();

  // Calculate number of days to show
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const chartDays = Math.min(daysDiff, 30); // Cap at 30 days for chart

  for (let i = chartDays - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const dayStart = new Date(d.setHours(0, 0, 0, 0));
    const dayEnd = new Date(d.setHours(23, 59, 59, 999));
    const dayInvoices = await tp.invoice.findMany({
      where: {
        issuedAt: { gte: dayStart, lte: dayEnd },
        status: "PAID",
      },
    });
    revenueChart.push({
      date: new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(d),
      value: dayInvoices.reduce((sum, i) => sum + Number(i.grandTotal), 0),
    });
  }

  return {
    revenue,
    expenses,
    profit,
    stockValue,
    revenueTrend,
    expensesTrend,
    profitTrend,
    stockTrend: 0,
    revenueChart,
    pipeline: [
      { label: "Stok", value: `${inventory.items.length} item`, status: "ok" },
      { label: "Penjualan", value: formatRupiah(revenue), status: "ok" },
      { label: "Pengeluaran", value: formatRupiah(expenses), status: "ok" },
      { label: "Profit", value: formatRupiah(profit), status: profit > 0 ? "ok" : "warning" },
    ],
  };
}

// =============================================================================
// KEUANGAN OVERVIEW REPORT
// =============================================================================

export type KeuanganOverviewData = {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  cashFlow: number;
  revenueTrend: number;
  expensesTrend: number;
  profitTrend: number;
  cashFlowTrend: number;
  revenueVsExpensesChart: { date: string; revenue: number; expenses: number }[];
  expenseByCategory: { name: string; value: number }[];
};

export async function getKeuanganOverview(startDate?: string, endDate?: string): Promise<KeuanganOverviewData> {
  await requireFeature("ADVANCED_REPORTS");

  const now = new Date();
  const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = endDate ? new Date(endDate) : now;

  // Get PnL report for current month
  const currentPnl = await getPnLReport(now.getMonth() + 1, now.getFullYear());
  const lastPnl = await getPnLReport(now.getMonth() === 1 ? 12 : now.getMonth() - 1, now.getMonth() === 1 ? now.getFullYear() - 1 : now.getFullYear());

  // Get expense report for the date range
  const expenseReport = await getExpenseReport(start.toISOString(), end.toISOString());

  const totalRevenue = currentPnl.netSales;
  const totalExpenses = currentPnl.opex;
  const netProfit = currentPnl.netProfit;

  // Cash flow = Revenue collected (payments) - Expenses paid
  // Simplified: use revenue - expenses for now
  const cashFlow = totalRevenue - totalExpenses;

  // Trends (vs last month)
  const lastRevenue = lastPnl.netSales;
  const lastExpenses = lastPnl.opex;
  const lastProfit = lastPnl.netProfit;
  const lastCashFlow = lastRevenue - lastExpenses;

  const revenueTrend = lastRevenue > 0 ? ((totalRevenue - lastRevenue) / lastRevenue) * 100 : 0;
  const expensesTrend = lastExpenses > 0 ? ((totalExpenses - lastExpenses) / lastExpenses) * 100 : 0;
  const profitTrend = lastProfit > 0 ? ((netProfit - lastProfit) / lastProfit) * 100 : 0;
  const cashFlowTrend = lastCashFlow > 0 ? ((cashFlow - lastCashFlow) / lastCashFlow) * 100 : 0;

  // Revenue vs Expenses chart (last 30 days)
  const tp = await requireTenantPrisma();
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const chartDays = Math.min(daysDiff, 30);

  const revenueVsExpensesChart: { date: string; revenue: number; expenses: number }[] = [];
  for (let i = chartDays - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const dayStart = new Date(d.setHours(0, 0, 0, 0));
    const dayEnd = new Date(d.setHours(23, 59, 59, 999));

    const [dayInvoices, dayExpenses] = await Promise.all([
      tp.invoice.findMany({
        where: {
          issuedAt: { gte: dayStart, lte: dayEnd },
          status: "PAID",
        },
      }),
      tp.expense.findMany({
        where: {
          date: { gte: dayStart, lte: dayEnd },
        },
      }),
    ]);

    revenueVsExpensesChart.push({
      date: new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(d),
      revenue: dayInvoices.reduce((sum, i) => sum + Number(i.grandTotal), 0),
      expenses: dayExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
    });
  }

  return {
    totalRevenue,
    totalExpenses,
    netProfit,
    cashFlow,
    revenueTrend,
    expensesTrend,
    profitTrend,
    cashFlowTrend,
    revenueVsExpensesChart,
    expenseByCategory: expenseReport.expensesByCategory,
  };
}
