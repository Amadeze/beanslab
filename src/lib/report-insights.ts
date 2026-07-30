/**
 * Report Insights Engine
 * Generates automated insights, alerts, and analysis for report data.
 */

export type InsightSeverity = "info" | "positive" | "negative" | "warning";

export interface Insight {
  severity: InsightSeverity;
  title: string;
  message: string;
  value?: string;
  metric?: string;
}

export interface Alert {
  id: string;
  severity: InsightSeverity;
  title: string;
  message: string;
  threshold?: number;
  current?: number;
}

// =============================================================================
// SALES INSIGHTS
// =============================================================================

export interface SalesInsightData {
  totalRevenue: number;
  invoiceCount: number;
  avgInvoice: number;
  topCustomer: string;
  previousPeriodRevenue?: number;
}

export function generateSalesInsights(data: SalesInsightData): Insight[] {
  const insights: Insight[] = [];
  const fmt = (v: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(v);

  // Revenue trend
  if (data.previousPeriodRevenue !== undefined && data.previousPeriodRevenue > 0) {
    const change = ((data.totalRevenue - data.previousPeriodRevenue) / data.previousPeriodRevenue) * 100;
    if (Math.abs(change) > 5) {
      insights.push({
        severity: change > 0 ? "positive" : "negative",
        title: change > 0 ? "Revenue Naik" : "Revenue Turun",
        message: `Revenue ${change > 0 ? "naik" : "turun"} ${Math.abs(change).toFixed(1)}% dari periode sebelumnya`,
        value: `${change > 0 ? "+" : ""}${change.toFixed(1)}%`,
        metric: "revenue_trend",
      });
    }
  }

  // Invoice analysis
  if (data.invoiceCount === 0) {
    insights.push({
      severity: "info",
      title: "Belum Ada Penjualan",
      message: "Tidak ada transaksi penjualan di periode ini",
      metric: "no_sales",
    });
  } else if (data.avgInvoice > 0) {
    insights.push({
      severity: "info",
      title: "Rata-rata Invoice",
      message: `Nilai rata-rata per invoice adalah ${fmt(data.avgInvoice)}`,
      value: fmt(data.avgInvoice),
      metric: "avg_invoice",
    });
  }

  // Top customer insight
  if (data.topCustomer && data.topCustomer !== "-") {
    insights.push({
      severity: "info",
      title: "Pelanggan Teratas",
      message: `Pelanggan dengan kontribusi terbesar: ${data.topCustomer}`,
      metric: "top_customer",
    });
  }

  return insights;
}

// =============================================================================
// EXPENSE INSIGHTS
// =============================================================================

export interface ExpenseInsightData {
  totalExpenses: number;
  totalPurchases: number;
  outstandingPayable: number;
  previousPeriodExpenses?: number;
}

export function generateExpenseInsights(data: ExpenseInsightData): Insight[] {
  const insights: Insight[] = [];
  const fmt = (v: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(v);

  // Expense trend
  if (data.previousPeriodExpenses !== undefined && data.previousPeriodExpenses > 0) {
    const change = ((data.totalExpenses - data.previousPeriodExpenses) / data.previousPeriodExpenses) * 100;
    if (Math.abs(change) > 10) {
      insights.push({
        severity: change > 0 ? "negative" : "positive",
        title: change > 0 ? "Pengeluaran Meningkat" : "Pengeluran Menurun",
        message: `Pengeluaran ${change > 0 ? "meningkat" : "menurun"} ${Math.abs(change).toFixed(1)}% dari periode sebelumnya`,
        value: `${change > 0 ? "+" : ""}${change.toFixed(1)}%`,
        metric: "expense_trend",
      });
    }
  }

  // Outstanding payable alert
  if (data.outstandingPayable > 0) {
    const severity = data.outstandingPayable > data.totalExpenses * 0.5 ? "warning" : "info";
    insights.push({
      severity,
      title: "Hutang Tertunda",
      message: `Masih ada hutang supplier sebesar ${fmt(data.outstandingPayable)} yang belum dibayar`,
      value: fmt(data.outstandingPayable),
      metric: "outstanding_payable",
    });
  }

  // Purchase ratio
  if (data.totalPurchases > 0 && data.totalExpenses > 0) {
    const ratio = (data.totalPurchases / (data.totalExpenses + data.totalPurchases)) * 100;
    insights.push({
      severity: "info",
      title: "Rasio Pembelian",
      message: `Pembelian menyumbang ${ratio.toFixed(1)}% dari total pengeluaran`,
      value: `${ratio.toFixed(1)}%`,
      metric: "purchase_ratio",
    });
  }

  return insights;
}

// =============================================================================
// ROASTING INSIGHTS
// =============================================================================

export interface RoastingInsightData {
  totalBatches: number;
  avgYield: number;
  lossPercent: number;
  totalGbUsed: number;
  totalRbProduced: number;
}

export function generateRoastingInsights(data: RoastingInsightData): Insight[] {
  const insights: Insight[] = [];

  if (data.totalBatches === 0) {
    insights.push({
      severity: "info",
      title: "Belum Ada Batch",
      message: "Tidak ada batch roasting di periode ini",
      metric: "no_batches",
    });
    return insights;
  }

  // Yield analysis
  if (data.avgYield > 0) {
    const severity: InsightSeverity = data.avgYield >= 85 ? "positive" : data.avgYield >= 75 ? "info" : "warning";
    insights.push({
      severity,
      title: "Yield Roasting",
      message: `Yield rata-rata ${data.avgYield.toFixed(1)}% (${data.lossPercent.toFixed(1)}% loss)`,
      value: `${data.avgYield.toFixed(1)}%`,
      metric: "avg_yield",
    });
  }

  // Efficiency insight
  if (data.totalGbUsed > 0) {
    const efficiency = (data.totalRbProduced / data.totalGbUsed) * 100;
    insights.push({
      severity: "info",
      title: "Efisiensi Produksi",
      message: `${data.totalGbUsed.toFixed(1)} kg GB menghasilkan ${data.totalRbProduced.toFixed(1)} kg RB`,
      metric: "efficiency",
    });
  }

  // Loss alert
  if (data.lossPercent > 20) {
    insights.push({
      severity: "warning",
      title: "Loss Tinggi",
      message: `Loss roasting ${data.lossPercent.toFixed(1)}% lebih tinggi dari normal (>15%)`,
      value: `${data.lossPercent.toFixed(1)}%`,
      metric: "high_loss",
    });
  }

  return insights;
}

// =============================================================================
// PRODUCTION INSIGHTS
// =============================================================================

export interface ProductionInsightData {
  totalBatches: number;
  totalFgProduced: number;
  efficiency: number;
}

export function generateProductionInsights(data: ProductionInsightData): Insight[] {
  const insights: Insight[] = [];

  if (data.totalBatches === 0) {
    insights.push({
      severity: "info",
      title: "Belum Ada Produksi",
      message: "Tidak ada batch produksi di periode ini",
      metric: "no_production",
    });
    return insights;
  }

  if (data.efficiency > 0) {
    const severity: InsightSeverity = data.efficiency >= 90 ? "positive" : data.efficiency >= 70 ? "info" : "warning";
    insights.push({
      severity,
      title: "Efisiensi Produksi",
      message: `Efisiensi produksi ${data.efficiency.toFixed(1)}%`,
      value: `${data.efficiency.toFixed(1)}%`,
      metric: "production_efficiency",
    });
  }

  return insights;
}

// =============================================================================
// DAILY INSIGHTS
// =============================================================================

export interface DailyInsightData {
  revenue: number;
  expenses: number;
  transactions: number;
  previousDayRevenue?: number;
  previousDayExpenses?: number;
}

export function generateDailyInsights(data: DailyInsightData): Insight[] {
  const insights: Insight[] = [];
  const fmt = (v: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(v);

  const netCashFlow = data.revenue - data.expenses;

  // Cash flow status
  if (netCashFlow >= 0) {
    insights.push({
      severity: "positive",
      title: "Cash Flow Positif",
      message: `Hari ini cash flow positif sebesar ${fmt(netCashFlow)}`,
      value: fmt(netCashFlow),
      metric: "positive_cashflow",
    });
  } else {
    insights.push({
      severity: "negative",
      title: "Cash Flow Negatif",
      message: `Hari ini cash flow negatif sebesar ${fmt(Math.abs(netCashFlow))}`,
      value: fmt(Math.abs(netCashFlow)),
      metric: "negative_cashflow",
    });
  }

  // Comparison with previous day
  if (data.previousDayRevenue !== undefined && data.previousDayRevenue > 0) {
    const change = ((data.revenue - data.previousDayRevenue) / data.previousDayRevenue) * 100;
    if (Math.abs(change) > 10) {
      insights.push({
        severity: change > 0 ? "positive" : "negative",
        title: "Perbandingan Kemarin",
        message: `Revenue ${change > 0 ? "naik" : "turun"} ${Math.abs(change).toFixed(1)}% dari kemarin`,
        value: `${change > 0 ? "+" : ""}${change.toFixed(1)}%`,
        metric: "daily_comparison",
      });
    }
  }

  // Transaction count
  if (data.transactions === 0) {
    insights.push({
      severity: "info",
      title: "Belum Ada Transaksi",
      message: "Belum ada invoice tercatat hari ini",
      metric: "no_transactions",
    });
  }

  return insights;
}

// =============================================================================
// ALERT SYSTEM
// =============================================================================

export interface AlertConfig {
  marginThreshold?: number;
  stockThreshold?: number;
  cashFlowAlertDays?: number;
  expenseThresholdPercent?: number;
}

const DEFAULT_ALERT_CONFIG: AlertConfig = {
  marginThreshold: 30,
  stockThreshold: 10,
  cashFlowAlertDays: 3,
  expenseThresholdPercent: 20,
};

export function checkMarginAlert(grossMarginPercent: number, config?: AlertConfig): Alert | null {
  const threshold = config?.marginThreshold ?? DEFAULT_ALERT_CONFIG.marginThreshold!;
  if (grossMarginPercent < threshold) {
    return {
      id: "low_margin",
      severity: "warning",
      title: "Margin Rendah",
      message: `Gross margin ${grossMarginPercent.toFixed(1)}% di bawah threshold ${threshold}%`,
      threshold,
      current: grossMarginPercent,
    };
  }
  return null;
}

export function checkExpenseAlert(expenseChangePercent: number, config?: AlertConfig): Alert | null {
  const threshold = config?.expenseThresholdPercent ?? DEFAULT_ALERT_CONFIG.expenseThresholdPercent!;
  if (expenseChangePercent > threshold) {
    return {
      id: "high_expense",
      severity: "warning",
      title: "Pengeluaran Melonjak",
      message: `Pengeluaran naik ${expenseChangePercent.toFixed(1)}% dari periode sebelumnya`,
      threshold,
      current: expenseChangePercent,
    };
  }
  return null;
}

export function checkCashFlowAlert(negativeDays: number, config?: AlertConfig): Alert | null {
  const threshold = config?.cashFlowAlertDays ?? DEFAULT_ALERT_CONFIG.cashFlowAlertDays!;
  if (negativeDays >= threshold) {
    return {
      id: "negative_cashflow",
      severity: "negative",
      title: "Cash Flow Negatif Berturut-turut",
      message: `Cash flow negatif selama ${negativeDays} hari berturut-turut`,
      threshold,
      current: negativeDays,
    };
  }
  return null;
}
