"use server";

import { getPnLReport } from "../keuangan/actions";
import { getSystemUserId, requireFeature, requireTenantPrisma } from "@/lib/auth";
import { getPayableAgingBucket } from "@/lib/purchase-payments";
import { revalidatePath } from "next/cache";
import { getCurrentDate } from "@/lib/date-utils";
import { weightedAverageCost } from "@/lib/financial-reporting";
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
