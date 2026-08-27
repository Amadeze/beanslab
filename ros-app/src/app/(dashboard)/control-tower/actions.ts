import "server-only";

import { requireRole, requireTenantPrisma } from "@/lib/auth";
import { getCurrentDate } from "@/lib/date-utils";
import { buildDemandPlan, type DemandPlan } from "@/lib/operations-planning";

export type ControlTowerData = {
  generatedAt: string;
  plan: DemandPlan;
  orders: Array<{
    id: string;
    code: string;
    customer: string;
    channel: string;
    status: string;
    dueDate: string | null;
    issuedAt: string;
    shortageUnits: number;
    value: number;
  }>;
  warehouse: {
    expiringLots: Array<{
      id: string;
      batchCode: string;
      item: string;
      expiryDate: string;
      remaining: number;
      unit: string;
      placed: boolean;
    }>;
    unplacedLotCount: number;
    openPoCount: number;
    latePoCount: number;
  };
  quality: {
    openRoastCount: number;
    completedWithoutCupping: number;
    averageYieldPercent: number | null;
    artisanEnabled: boolean;
  };
  b2b: {
    activeContracts: number;
    expiringContracts: number;
    sales30Days: number;
    overdueReceivables: number;
    overdueValue: number;
  };
  finance: {
    revenue30Days: number;
    grossProfit30Days: number;
    grossMarginPercent: number | null;
    lossMakingSkus: Array<{ product: string; units: number; margin: number }>;
  };
  readiness: Array<{
    key: string;
    label: string;
    ready: boolean;
    detail: string;
    href: string;
  }>;
};

function daysAgo(date: Date, days: number) {
  return new Date(date.getTime() - days * 86_400_000);
}

export async function getControlTowerData(): Promise<ControlTowerData> {
  const user = await requireRole("OWNER", "MANAGER", "OPERATOR");
  const tp = await requireTenantPrisma();
  const now = getCurrentDate();
  const thirtyDaysAgo = daysAgo(now, 30);
  const thirtyDaysAhead = daysAgo(now, -30);

  const [
    tenant,
    products,
    supplies,
    recipes,
    openInvoices,
    reservations,
    openPurchaseOrders,
    deliveredItems,
    recentSupplyUsage,
    roastHistory,
    urgentOrders,
    expiringLots,
    unplacedLotCount,
    openRoasts,
    completedRoastsWithoutCupping,
    activeContracts,
    expiringContracts,
    b2bInvoices,
    overdueB2bInvoices,
    activePaymentMethods,
    portalTheme,
  ] = await Promise.all([
    tp.tenant.findUnique({
      where: { id: user.tenantId },
      select: {
        isArtisanEnabled: true,
        nationalCourierEnabled: true,
        rajaOngkirOriginId: true,
        rajaOngkirCourierCodes: true,
        setupCompletedAt: true,
      },
    }),
    tp.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        stockKg: true,
        stockUnit: true,
        safetyStockQuantity: true,
        leadTimeDays: true,
        materialOrigin: true,
        sourceGreenBeanId: true,
      },
    }),
    tp.inventorySupplyItem.findMany({
      where: { isActive: true, consumableInProduction: true },
      select: {
        id: true,
        code: true,
        name: true,
        baseUnit: true,
        stockQuantity: true,
        safetyStockQuantity: true,
        leadTimeDays: true,
      },
    }),
    tp.recipe.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      select: {
        productId: true,
        outputGrams: true,
        items: { select: { productId: true, gramsPerUnit: true } },
        supplyItems: { select: { supplyItemId: true, quantityPerUnit: true } },
      },
    }),
    tp.invoice.findMany({
      where: {
        voidAt: null,
        fulfillmentStatus: { in: ["AWAITING_PAYMENT", "NEEDS_PRODUCTION", "READY_TO_PACK", "PACKED", "SHIPPED"] },
      },
      select: {
        items: {
          where: { product: { type: "FINISHED_GOODS" } },
          select: { productId: true, quantity: true },
        },
      },
    }),
    tp.stockReservation.findMany({
      where: { status: "ACTIVE" },
      select: { productId: true, quantity: true, quantityKg: true, product: { select: { type: true } } },
    }),
    tp.purchaseOrder.findMany({
      where: { status: { in: ["SENT", "PARTIAL"] } },
      select: {
        expectedDate: true,
        items: { select: { productId: true, supplyItemId: true, quantity: true, supplyQuantity: true } },
        purchases: {
          where: { status: "COMPLETED", voidAt: null },
          select: { productId: true, supplyItemId: true, weightKg: true, quantityUnits: true, supplyQuantity: true },
        },
      },
    }),
    tp.invoiceItem.findMany({
      where: {
        invoice: { deliveredAt: { gte: thirtyDaysAgo }, voidAt: null },
        product: { type: "FINISHED_GOODS" },
      },
      select: {
        productId: true,
        quantity: true,
        subtotal: true,
        hpp: true,
        product: { select: { name: true } },
        invoice: { select: { subtotal: true, grandTotal: true, returnedAmount: true } },
      },
    }),
    tp.inventoryLedger.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        entryType: "OUT",
        refType: { in: ["SUPPLY_PRODUCTION_OUT", "SUPPLY_ADJUSTMENT_OUT"] },
        supplyItemId: { not: null },
      },
      select: { supplyItemId: true, supplyQuantity: true },
    }),
    tp.parentRoastingBatch.findMany({
      where: { status: "COMPLETED", targetWeightKg: { gt: 0 }, actualOutputKg: { not: null } },
      orderBy: { completedAt: "desc" },
      take: 300,
      select: { outputProductId: true, targetWeightKg: true, actualOutputKg: true },
    }),
    tp.invoice.findMany({
      where: {
        voidAt: null,
        fulfillmentStatus: { in: ["AWAITING_PAYMENT", "NEEDS_PRODUCTION", "READY_TO_PACK", "PACKED", "SHIPPED"] },
      },
      orderBy: [{ dueDate: "asc" }, { issuedAt: "asc" }],
      take: 12,
      select: {
        id: true,
        code: true,
        status: true,
        salesChannel: true,
        dueDate: true,
        issuedAt: true,
        grandTotal: true,
        customer: { select: { name: true } },
        fulfillmentTasks: { where: { status: { in: ["OPEN", "IN_PROGRESS"] } }, select: { shortageQuantity: true } },
      },
    }),
    tp.lot.findMany({
      where: { consumedAt: null, expiryDate: { not: null, lte: thirtyDaysAhead } },
      orderBy: { expiryDate: "asc" },
      take: 20,
      select: {
        id: true,
        batchCode: true,
        expiryDate: true,
        quantityKg: true,
        quantityUnit: true,
        supplyQuantity: true,
        product: { select: { name: true, type: true } },
        packaging: { select: { name: true } },
        supplyItem: { select: { name: true, baseUnit: true } },
        _count: { select: { placements: true } },
      },
    }),
    tp.lot.count({ where: { consumedAt: null, placements: { none: {} } } }),
    tp.parentRoastingBatch.count({ where: { status: "PENDING" } }),
    tp.parentRoastingBatch.count({
      where: { status: "COMPLETED", completedAt: { gte: thirtyDaysAgo }, cuppingSessions: { none: {} } },
    }),
    tp.contract.count({ where: { isActive: true, OR: [{ endDate: null }, { endDate: { gte: now } }] } }),
    tp.contract.count({ where: { isActive: true, endDate: { gte: now, lte: thirtyDaysAhead } } }),
    tp.invoice.findMany({
      where: { salesChannel: "B2B_DIRECT", deliveredAt: { gte: thirtyDaysAgo }, voidAt: null },
      select: { grandTotal: true, returnedAmount: true },
    }),
    tp.invoice.findMany({
      where: {
        salesChannel: "B2B_DIRECT",
        status: { in: ["ISSUED", "PARTIAL"] },
        dueDate: { lt: now },
        voidAt: null,
      },
      select: { grandTotal: true, paidAmount: true, returnedAmount: true },
    }),
    tp.tenantPaymentMethod.count({ where: { isActive: true } }),
    tp.portalTheme.findUnique({ where: { tenantId: user.tenantId }, select: { id: true } }),
  ]);

  const salesByProduct = new Map<string, number>();
  for (const item of deliveredItems) {
    salesByProduct.set(item.productId, (salesByProduct.get(item.productId) ?? 0) + item.quantity);
  }
  const supplyUsageByItem = new Map<string, number>();
  for (const row of recentSupplyUsage) {
    if (!row.supplyItemId) continue;
    supplyUsageByItem.set(row.supplyItemId, (supplyUsageByItem.get(row.supplyItemId) ?? 0) + Number(row.supplyQuantity ?? 0));
  }

  const receivedProduct = new Map<string, number>();
  const receivedSupply = new Map<string, number>();
  const orderedProduct = new Map<string, number>();
  const orderedSupply = new Map<string, number>();
  for (const po of openPurchaseOrders) {
    for (const item of po.items) {
      if (item.productId) orderedProduct.set(item.productId, (orderedProduct.get(item.productId) ?? 0) + Number(item.quantity));
      if (item.supplyItemId) orderedSupply.set(item.supplyItemId, (orderedSupply.get(item.supplyItemId) ?? 0) + Number(item.supplyQuantity ?? item.quantity));
    }
    for (const receipt of po.purchases) {
      if (receipt.productId) {
        const quantity = Number(receipt.weightKg ?? receipt.quantityUnits ?? 0);
        receivedProduct.set(receipt.productId, (receivedProduct.get(receipt.productId) ?? 0) + quantity);
      }
      if (receipt.supplyItemId) receivedSupply.set(receipt.supplyItemId, (receivedSupply.get(receipt.supplyItemId) ?? 0) + Number(receipt.supplyQuantity ?? 0));
    }
  }

  const yieldTotals = new Map<string, { input: number; output: number }>();
  for (const roast of roastHistory) {
    const row = yieldTotals.get(roast.outputProductId) ?? { input: 0, output: 0 };
    row.input += Number(roast.targetWeightKg);
    row.output += Number(roast.actualOutputKg ?? 0);
    yieldTotals.set(roast.outputProductId, row);
  }

  const latestRecipes = new Map<string, (typeof recipes)[number]>();
  for (const recipe of recipes) if (!latestRecipes.has(recipe.productId)) latestRecipes.set(recipe.productId, recipe);

  const plan = buildDemandPlan({
    products: products
      .filter((product) => product.type === "FINISHED_GOODS" || product.type === "ROASTED_BEAN" || product.type === "GREEN_BEAN")
      .map((product) => ({
        id: product.id,
        code: product.code,
        name: product.name,
        kind: product.type as "FINISHED_GOODS" | "ROASTED_BEAN" | "GREEN_BEAN",
        onHand: Number(product.type === "FINISHED_GOODS" ? product.stockUnit : product.stockKg),
        safetyStock: Number(product.safetyStockQuantity),
        leadTimeDays: product.leadTimeDays,
        averageDailyDemand: (salesByProduct.get(product.id) ?? 0) / 30,
        materialOrigin: product.materialOrigin,
        sourceGreenBeanId: product.sourceGreenBeanId,
      })),
    supplies: supplies.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      baseUnit: item.baseUnit,
      onHand: Number(item.stockQuantity),
      safetyStock: Number(item.safetyStockQuantity),
      leadTimeDays: item.leadTimeDays,
      averageDailyDemand: (supplyUsageByItem.get(item.id) ?? 0) / 30,
    })),
    recipes: [...latestRecipes.values()].map((recipe) => ({
      productId: recipe.productId,
      outputGrams: Number(recipe.outputGrams),
      coffeeItems: recipe.items.map((item) => ({ productId: item.productId, quantityPerUnitKg: Number(item.gramsPerUnit) / 1000 })),
      supplyItems: recipe.supplyItems.map((item) => ({ supplyItemId: item.supplyItemId, quantityPerUnit: Number(item.quantityPerUnit) })),
    })),
    openDemand: openInvoices.flatMap((invoice) => invoice.items.map((item) => ({ productId: item.productId, quantity: item.quantity }))),
    commitments: reservations.map((reservation) => ({
      productId: reservation.productId,
      quantity: reservation.product.type === "FINISHED_GOODS" ? reservation.quantity : Number(reservation.quantityKg ?? 0),
    })),
    incomingProducts: [...orderedProduct].map(([productId, quantity]) => ({
      productId,
      quantity: Math.max(0, quantity - (receivedProduct.get(productId) ?? 0)),
    })),
    incomingSupplies: [...orderedSupply].map(([supplyItemId, quantity]) => ({
      supplyItemId,
      quantity: Math.max(0, quantity - (receivedSupply.get(supplyItemId) ?? 0)),
    })),
    yieldByRoastedProduct: [...yieldTotals].map(([productId, value]) => ({
      productId,
      yieldRate: value.input > 0 ? value.output / value.input : 0,
    })),
  });

  function invoiceNetFactor(item: (typeof deliveredItems)[number]) {
    const invoiceSubtotal = Number(item.invoice.subtotal);
    if (invoiceSubtotal <= 0) return 0;
    return Math.max(0, Number(item.invoice.grandTotal) - Number(item.invoice.returnedAmount)) / invoiceSubtotal;
  }
  const revenue30Days = deliveredItems.reduce((sum, item) => sum + Number(item.subtotal) * invoiceNetFactor(item), 0);
  const cogs30Days = deliveredItems.reduce((sum, item) => sum + Number(item.hpp) * item.quantity * invoiceNetFactor(item), 0);
  const marginByProduct = new Map<string, { name: string; units: number; margin: number }>();
  for (const item of deliveredItems) {
    const row = marginByProduct.get(item.productId) ?? { name: item.product.name, units: 0, margin: 0 };
    row.units += item.quantity;
    const netFactor = invoiceNetFactor(item);
    row.margin += (Number(item.subtotal) - Number(item.hpp) * item.quantity) * netFactor;
    marginByProduct.set(item.productId, row);
  }
  const totalRoastInput = roastHistory.reduce((sum, roast) => sum + Number(roast.targetWeightKg), 0);
  const totalRoastOutput = roastHistory.reduce((sum, roast) => sum + Number(roast.actualOutputKg ?? 0), 0);
  const averageYield = totalRoastInput > 0 ? totalRoastOutput / totalRoastInput * 100 : null;

  const b2bSales = b2bInvoices.reduce((sum, invoice) => sum + Math.max(0, Number(invoice.grandTotal) - Number(invoice.returnedAmount)), 0);
  const overdueValue = overdueB2bInvoices.reduce(
    (sum, invoice) => sum + Math.max(0, Number(invoice.grandTotal) - Number(invoice.paidAmount) - Number(invoice.returnedAmount)),
    0,
  );
  const courierCodes = Array.isArray(tenant?.rajaOngkirCourierCodes) ? tenant.rajaOngkirCourierCodes : [];
  const finishedGoodsWithoutRecipe = plan.finishedGoods.filter((row) => row.suggestedProduction > 0 && !row.hasRecipe).length;

  return {
    generatedAt: now.toISOString(),
    plan,
    orders: urgentOrders.map((invoice) => ({
      id: invoice.id,
      code: invoice.code,
      customer: invoice.customer.name,
      channel: invoice.salesChannel,
      status: invoice.fulfillmentTasks.length ? "Perlu produksi" : invoice.status,
      dueDate: invoice.dueDate?.toISOString() ?? null,
      issuedAt: invoice.issuedAt.toISOString(),
      shortageUnits: invoice.fulfillmentTasks.reduce((sum, task) => sum + task.shortageQuantity, 0),
      value: Number(invoice.grandTotal),
    })),
    warehouse: {
      expiringLots: expiringLots.map((lot) => {
        const isKg = lot.product?.type === "GREEN_BEAN" || lot.product?.type === "ROASTED_BEAN";
        return {
          id: lot.id,
          batchCode: lot.batchCode,
          item: lot.product?.name ?? lot.supplyItem?.name ?? lot.packaging?.name ?? "Item",
          expiryDate: lot.expiryDate!.toISOString(),
          remaining: Number(isKg ? lot.quantityKg : lot.supplyItem ? lot.supplyQuantity : lot.quantityUnit),
          unit: isKg ? "kg" : lot.supplyItem?.baseUnit ?? "unit",
          placed: lot._count.placements > 0,
        };
      }),
      unplacedLotCount,
      openPoCount: openPurchaseOrders.length,
      latePoCount: openPurchaseOrders.filter((po) => po.expectedDate && po.expectedDate < now).length,
    },
    quality: {
      openRoastCount: openRoasts,
      completedWithoutCupping: completedRoastsWithoutCupping,
      averageYieldPercent: averageYield,
      artisanEnabled: tenant?.isArtisanEnabled ?? false,
    },
    b2b: {
      activeContracts,
      expiringContracts,
      sales30Days: b2bSales,
      overdueReceivables: overdueB2bInvoices.length,
      overdueValue,
    },
    finance: {
      revenue30Days,
      grossProfit30Days: revenue30Days - cogs30Days,
      grossMarginPercent: revenue30Days > 0 ? (revenue30Days - cogs30Days) / revenue30Days * 100 : null,
      lossMakingSkus: [...marginByProduct.values()]
        .filter((row) => row.margin < 0)
        .sort((a, b) => a.margin - b.margin)
        .map((row) => ({ product: row.name, units: row.units, margin: row.margin })),
    },
    readiness: [
      {
        key: "recipe",
        label: "Resep untuk kebutuhan produksi",
        ready: finishedGoodsWithoutRecipe === 0,
        detail: finishedGoodsWithoutRecipe ? `${finishedGoodsWithoutRecipe} produk perlu resep sebelum dapat direncanakan.` : "Semua rekomendasi produksi dapat diturunkan ke material.",
        href: "/katalog",
      },
      {
        key: "warehouse",
        label: "Penempatan lot",
        ready: unplacedLotCount === 0,
        detail: unplacedLotCount ? `${unplacedLotCount} lot aktif belum memiliki lokasi fisik.` : "Semua lot aktif sudah memiliki lokasi.",
        href: "/inventory/lots",
      },
      {
        key: "payments",
        label: "Metode pembayaran storefront",
        ready: activePaymentMethods > 0,
        detail: activePaymentMethods ? `${activePaymentMethods} metode pembayaran aktif.` : "Aktifkan minimal satu tujuan pembayaran.",
        href: "/settings",
      },
      {
        key: "shipping",
        label: "Pengiriman nasional",
        ready: !tenant?.nationalCourierEnabled || Boolean(tenant.rajaOngkirOriginId && courierCodes.length),
        detail: tenant?.nationalCourierEnabled ? "Origin dan kurir harus lengkap sebelum checkout nasional." : "Pengiriman nasional tidak diaktifkan.",
        href: "/settings",
      },
      {
        key: "storefront",
        label: "Storefront tenant",
        ready: Boolean(portalTheme),
        detail: portalTheme ? "Storefront memiliki konfigurasi theme." : "Selesaikan konfigurasi storefront sebelum publikasi.",
        href: "/portal-theme",
      },
      {
        key: "setup",
        label: "Setup organisasi",
        ready: Boolean(tenant?.setupCompletedAt),
        detail: tenant?.setupCompletedAt ? "Setup awal organisasi selesai." : "Setup awal masih belum ditandai selesai.",
        href: "/settings",
      },
    ],
  };
}
