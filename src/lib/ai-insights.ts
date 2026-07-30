import { formatRupiah, formatDate } from "./format";
import { getZonedDayRange, getZonedMonthRange, getCurrentDate } from "./date-utils";
import { calculateSalesPerformance } from "./financial-reporting";

export type AiInsightResult = {
  answer: string;
  data: Record<string, unknown> | unknown[] | null;
  reportName: string;
};

function q(query: string): string {
  return query.toLowerCase().trim();
}

function matchesAny(text: string, patterns: string[]): boolean {
  const lower = text.toLowerCase();
  return patterns.some((p) => lower.includes(p));
}

function toNum(val: unknown): number {
  return Number(val ?? 0);
}

async function fetchExpenses(prisma: any, start: Date, end: Date): Promise<number> {
  const expenses = await prisma.expense.findMany({
    where: { date: { gte: start, lt: end }, voidAt: null },
    select: { amount: true },
  });
  return expenses.reduce((sum: number, e: any) => sum + toNum(e.amount), 0);
}

async function fetchProfit(prisma: any, start: Date, end: Date) {
  const [invoices, expenses, samples] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        issuedAt: { gte: start, lt: end },
        voidAt: null,
        status: { in: ["ISSUED", "PARTIAL", "PAID"] },
      },
      select: {
        subtotal: true,
        discount: true,
        tax: true,
        customer: { select: { name: true } },
        items: {
          select: {
            quantity: true,
            subtotal: true,
            hpp: true,
            product: { select: { type: true, name: true } },
          },
        },
      },
    }),
    fetchExpenses(prisma, start, end),
    prisma.sampleUsage.aggregate({
      where: { status: "COMPLETED", givenAt: { gte: start, lt: end }, voidAt: null },
      _sum: { totalCost: true },
    }),
  ]);

  const sales = calculateSalesPerformance(invoices.map((invoice: any) => ({
    subtotal: toNum(invoice.subtotal),
    discount: toNum(invoice.discount),
    tax: toNum(invoice.tax),
    customerName: invoice.customer?.name ?? null,
    items: invoice.items.map((item: any) => ({
      productType: item.product?.type ?? null,
      productName: item.product?.name ?? null,
      quantity: item.quantity,
      subtotal: toNum(item.subtotal),
      hpp: toNum(item.hpp),
    })),
  })));
  const sampleCost = toNum(samples._sum.totalCost);
  const operatingExpenses = expenses + sampleCost;
  const profit = sales.netSales - sales.cogs - operatingExpenses;

  return {
    revenue: sales.netSales,
    cogs: sales.cogs,
    expenses,
    sampleCost,
    operatingExpenses,
    profit,
    margin: sales.netSales > 0 ? (profit / sales.netSales) * 100 : 0,
  };
}

async function fetchTopCustomers(prisma: any, start: Date, end: Date) {
  const invoices = await prisma.invoice.findMany({
    where: { issuedAt: { gte: start, lt: end }, voidAt: null, status: { in: ["ISSUED", "PAID", "PARTIAL"] } },
    include: { customer: { select: { name: true } } },
    select: { grandTotal: true, customer: { select: { name: true } } },
  });

  const customerMap = new Map<string, { revenue: number; count: number }>();
  for (const inv of invoices as any[]) {
    const name = inv.customer?.name ?? "Umum";
    const current = customerMap.get(name) ?? { revenue: 0, count: 0 };
    current.revenue += toNum(inv.grandTotal);
    current.count += 1;
    customerMap.set(name, current);
  }

  return Array.from(customerMap.entries())
    .map(([name, data]) => ({ name, revenue: data.revenue, count: data.count }))
    .sort((a: any, b: any) => b.revenue - a.revenue)
    .slice(0, 5);
}

async function fetchGreenBeanStock(prisma: any) {
  const products = await prisma.product.findMany({
    where: { type: "GREEN_BEAN", isActive: true },
    select: { id: true, name: true, code: true, stockKg: true },
  });

  return (products as any[])
    .map((p: any) => ({ name: p.name, code: p.code, stockKg: toNum(p.stockKg) }))
    .filter((p: any) => p.stockKg < 10)
    .sort((a: any, b: any) => a.stockKg - b.stockKg);
}

async function fetchMonthlyPurchases(prisma: any, year: number, month: number) {
  const { start, end } = getZonedMonthRange(year, month);
  const purchases = await prisma.purchase.findMany({
    where: { receivedAt: { gte: start, lt: end }, status: "COMPLETED", voidAt: null },
    select: { totalCost: true },
  });
  const totalCost = purchases.reduce((sum: number, p: any) => sum + toNum(p.totalCost), 0);
  return { totalCost, count: purchases.length };
}

async function fetchDailySales(prisma: any) {
  const today = getCurrentDate();
  const { start, end } = getZonedDayRange(today);

  const invoices = await prisma.invoice.findMany({
    where: { issuedAt: { gte: start, lt: end }, voidAt: null, status: { in: ["ISSUED", "PAID", "PARTIAL"] } },
    select: { grandTotal: true },
  });

  const revenue = invoices.reduce((sum: number, inv: any) => sum + toNum(inv.grandTotal), 0);
  const invoiceCount = invoices.length;
  const avgInvoice = invoiceCount > 0 ? revenue / invoiceCount : 0;

  return { revenue, invoiceCount, avgInvoice };
}

export async function queryReports(queryStr: string, prisma: any): Promise<AiInsightResult> {
  const query = q(queryStr);
  const now = getCurrentDate();

  if (matchesAny(query, ["profit", "keuntungan", "laba bersih", "margin keuntungan"])) {
    let start: Date;
    let end: Date;
    let periodLabel: string;
    let reportName: string;

    if (matchesAny(query, ["minggu ini", "pekan ini"])) {
      const day = now.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      start = new Date(now);
      start.setDate(start.getDate() - diffToMonday);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(end.getDate() + 7);
      periodLabel = "Minggu Ini";
      reportName = "Profit Mingguan";
    } else if (matchesAny(query, ["bulan ini", "bulan berjalan"])) {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      periodLabel = "Bulan Ini";
      reportName = "Profit Bulanan";
    } else if (matchesAny(query, ["kemarin", "hari lalu"])) {
      start = new Date(now);
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(end.getDate() + 1);
      periodLabel = "Kemarin";
      reportName = "Profit Harian";
    } else {
      const { start: s, end: e } = getZonedMonthRange(now.getFullYear(), now.getMonth() + 1);
      start = s;
      end = e;
      periodLabel = "Bulan Ini";
      reportName = "Profit Bulanan";
    }

    const result = await fetchProfit(prisma, start, end);

    return {
      answer: `Laba bersih ${periodLabel}: ${formatRupiah(result.profit)} (margin ${result.margin.toFixed(1)}%). Penjualan bersih ${formatRupiah(result.revenue)}, HPP ${formatRupiah(result.cogs)}, dan beban operasional ${formatRupiah(result.operatingExpenses)}.`,
      data: { ...result, periodLabel },
      reportName,
    };
  }

  if (matchesAny(query, ["customer terbesar", "customer teratas", "top customer", "pelanggan terbesar", "pelanggan teratas", "siapa customer terbesar"])) {
    const today = getCurrentDate();
    const { start, end } = getZonedDayRange(today);

    let periodStart = start;
    let periodEnd = end;
    let reportName = "Top Customer Hari Ini";

    if (matchesAny(query, ["minggu ini", "pekan ini"])) {
      const day = today.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      periodStart = new Date(today);
      periodStart.setDate(periodStart.getDate() - diffToMonday);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + 7);
      reportName = "Top Customer Minggu Ini";
    } else if (matchesAny(query, ["bulan ini", "bulan berjalan"])) {
      periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
      periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      reportName = "Top Customer Bulan Ini";
    }

    const topCustomers = await fetchTopCustomers(prisma, periodStart, periodEnd);

    if (topCustomers.length === 0) {
      return { answer: "Tidak ada data customer untuk periode ini.", data: [], reportName };
    }

    const lines = topCustomers
      .map((c: any, i: number) => `${i + 1}. ${c.name} — ${formatRupiah(c.revenue)} (${c.count} transaksi)`)
      .join("\n");

    return {
      answer: `Top customer ${formatDate(periodStart)}:\n${lines}`,
      data: topCustomers,
      reportName,
    };
  }

  if (matchesAny(query, ["green bean stok", "stokgb", "stok gb", "stok kopi", "stock kopi", "gb stok", "stokhabis", "stok mau habis", "stok rendah", "stok hampir habis"])) {
    const lowStock = await fetchGreenBeanStock(prisma);

    if (lowStock.length === 0) {
      return { answer: "Semua stok green bean dalam kondisi aman (>= 10 kg).", data: [], reportName: "Stok Green Bean" };
    }

    const lines = lowStock
      .map((gb: any) => `${gb.name} (${gb.code}): ${gb.stockKg.toFixed(2)} kg`)
      .join("\n");

    return {
      answer: `Stok green bean rendah:\n${lines}`,
      data: lowStock,
      reportName: "Stok Green Bean",
    };
  }

  if (matchesAny(query, ["pembelian bulan ini", "berapa pembelian", "pembelian gb", "total pembelian", "pembelian bulan berjalan"])) {
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const purchases = await fetchMonthlyPurchases(prisma, year, month);

    return {
      answer: `Total pembelian GB bulan ${month}/${year}: ${formatRupiah(purchases.totalCost)} (${purchases.count} transaksi).`,
      data: purchases,
      reportName: "Pembelian Bulan Ini",
    };
  }

  if (matchesAny(query, ["penjualan hari ini", "omzet hari ini", "penjualan hari", "omzet hari", "daily sales", "daily revenue", "pendapatan hari ini", "omzet"])) {
    const daily = await fetchDailySales(prisma);

    return {
      answer: `Omzet hari ini: ${formatRupiah(daily.revenue)} (${daily.invoiceCount} transaksi, avg ${formatRupiah(daily.avgInvoice)} per invoice).`,
      data: daily,
      reportName: "Omzet Harian",
    };
  }

  return {
    answer:
      "Saya bisa menjawab pertanyaan tentang:\n" +
      "• Profit minggu ini / keuntungan bulan ini\n" +
      "• Top customer terbesar / teratas\n" +
      "• Green bean stok rendah\n" +
      "• Pembelian bulan ini / total pembelian GB\n" +
      "• Penjualan hari ini / omzet hari ini\n\n" +
      "Silakan tanyakan salah satu dari topik di atas.",
    data: null,
    reportName: "Bantuan",
  };
}
