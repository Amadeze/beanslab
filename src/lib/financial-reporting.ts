export type FinancialInvoice = {
  subtotal: number;
  discount: number;
  tax: number;
  /** Nilai barang diretur (returnedAmount) — dikurangkan dari pendapatan. */
  returnedAmount?: number;
  customerName: string | null;
  items: Array<{
    productType: string | null;
    productName: string | null;
    quantity: number;
    subtotal: number;
    hpp: number;
  }>;
};

export type SalesPerformance = {
  grossSales: number;
  invoiceDiscount: number;
  tax: number;
  netSales: number;
  cogs: number;
  grossProfit: number;
  salesVolumeUnits: number;
  revenueBreakdown: { category: string; amount: number }[];
  cogsBreakdown: { category: string; amount: number }[];
  topProducts: { name: string; quantity: number; revenue: number }[];
  topCustomers: { name: string; count: number; revenue: number }[];
};

/**
 * Calculates accrual sales consistently for both current and comparative periods.
 * Header discounts are allocated proportionally to lines so the breakdown always
 * reconciles to net sales. Taxes collected for third parties are not revenue.
 *
 * Retur (returnedAmount): dialokasikan proporsional ke baris.
 * - Pendapatan: faktor neto (subtotal − diskon − retur) — diskon & retur
 *   sama-sama mengurangi pendapatan.
 * - COGS: faktor retur saja (subtotal − retur) — barang diretur kembali ke
 *   stok sehingga biayanya ikut berkurang; diskon TIDAK mengubah biaya.
 */
export function calculateSalesPerformance(
  invoices: FinancialInvoice[],
): SalesPerformance {
  const revenueByCategory = new Map<string, number>();
  const cogsByCategory = new Map<string, number>();
  const products = new Map<string, { quantity: number; revenue: number }>();
  const customers = new Map<string, { count: number; revenue: number }>();

  let grossSales = 0;
  let invoiceDiscount = 0;
  let tax = 0;
  let totalReturns = 0;
  let cogs = 0;
  let salesVolumeUnits = 0;

  for (const invoice of invoices) {
    const headerSubtotal = Math.max(0, invoice.subtotal);
    const headerDiscount = Math.min(Math.max(0, invoice.discount), headerSubtotal);
    const returnedAmount = Math.max(0, invoice.returnedAmount ?? 0);
    const lineSubtotal = invoice.items.reduce(
      (sum, item) => sum + Math.max(0, item.subtotal),
      0,
    );
    const revenueFactor = lineSubtotal > 0
      ? Math.max(0, headerSubtotal - headerDiscount - returnedAmount) / lineSubtotal
      : 0;
    const cogsFactor = headerSubtotal > 0
      ? Math.max(0, headerSubtotal - returnedAmount) / headerSubtotal
      : 0;
    const invoiceNetSales = Math.max(0, headerSubtotal - headerDiscount - returnedAmount);

    grossSales += headerSubtotal;
    invoiceDiscount += headerDiscount;
    totalReturns += returnedAmount;
    tax += Math.max(0, invoice.tax);

    const customerName = invoice.customerName?.trim();
    if (customerName && customerName.toLocaleLowerCase("id-ID") !== "umum") {
      const current = customers.get(customerName) ?? { count: 0, revenue: 0 };
      current.count += 1;
      current.revenue += invoiceNetSales;
      customers.set(customerName, current);
    }

    for (const item of invoice.items) {
      const category = item.productType || "LAINNYA";
      const productName = item.productName || "Produk Tidak Dikenal";
      const itemRevenue = Math.max(0, item.subtotal) * revenueFactor;
      const itemCogs = Math.max(0, item.hpp) * Math.max(0, item.quantity) * cogsFactor;

      revenueByCategory.set(
        category,
        (revenueByCategory.get(category) ?? 0) + itemRevenue,
      );
      cogsByCategory.set(category, (cogsByCategory.get(category) ?? 0) + itemCogs);
      cogs += itemCogs;
      salesVolumeUnits += Math.max(0, item.quantity);

      const product = products.get(productName) ?? { quantity: 0, revenue: 0 };
      product.quantity += Math.max(0, item.quantity);
      product.revenue += itemRevenue;
      products.set(productName, product);
    }
  }

  const netSales = Math.max(0, grossSales - invoiceDiscount - totalReturns);
  return {
    grossSales,
    invoiceDiscount,
    tax,
    netSales,
    cogs,
    grossProfit: netSales - cogs,
    salesVolumeUnits,
    revenueBreakdown: [...revenueByCategory].map(([category, amount]) => ({ category, amount })),
    cogsBreakdown: [...cogsByCategory].map(([category, amount]) => ({ category, amount })),
    topProducts: [...products]
      .map(([name, values]) => ({ name, ...values }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5),
    topCustomers: [...customers]
      .map(([name, values]) => ({ name, ...values }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5),
  };
}

export function weightedAverageCost(
  layers: Array<{ quantity: number; totalCost: number }>,
): number {
  const totals = layers.reduce(
    (result, layer) => {
      if (layer.quantity <= 0 || layer.totalCost < 0) return result;
      result.quantity += layer.quantity;
      result.cost += layer.totalCost;
      return result;
    },
    { quantity: 0, cost: 0 },
  );
  return totals.quantity > 0 ? totals.cost / totals.quantity : 0;
}
