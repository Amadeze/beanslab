import { formatRupiah } from "@/lib/format";

export type DashboardQueueSignals = {
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

export type DashboardQueueStockItem = {
  id: string;
  name: string;
  stock: number;
  unit: "kg" | "pcs";
  threshold: number;
};

export type DashboardQueueBriefAction = {
  severity: "INFO" | "WARNING" | "CRITICAL";
  label: string;
  href: string;
};

export type DashboardWorkItem = {
  id: string;
  title: string;
  context: string;
  domain: string;
  actionLabel: string;
  href: string;
  severity: "critical" | "warning";
};

type RankedWorkItem = DashboardWorkItem & { priority: number };

export function buildDashboardWorkItems({
  signals,
  lowStock,
  dailyActions = [],
  limit = 7,
}: {
  signals: DashboardQueueSignals;
  lowStock: DashboardQueueStockItem[];
  dailyActions?: DashboardQueueBriefAction[];
  limit?: number;
}): DashboardWorkItem[] {
  const items: RankedWorkItem[] = [];

  if (signals.paymentReviews > 0) {
    items.push({
      id: "payment-reviews",
      title: `${signals.paymentReviews} bukti pembayaran menunggu keputusan`,
      context: "Kas belum dibukukan sampai bukti disetujui",
      domain: "Penjualan",
      actionLabel: "Periksa",
      href: "/penjualan/pembayaran",
      severity: "critical",
      priority: 10,
    });
  }

  if (signals.fulfillmentNeedsProduction > 0) {
    items.push({
      id: "fulfillment-production",
      title: `${signals.fulfillmentNeedsProduction} pesanan tertahan di produksi`,
      context: "Stok barang jadi belum cukup untuk memenuhi pesanan",
      domain: "Produksi",
      actionLabel: "Buat produksi",
      href: "/penjualan/fulfillment",
      severity: "critical",
      priority: 20,
    });
  }

  if (signals.overdueReceivables.count > 0) {
    items.push({
      id: "overdue-receivables",
      title: `${signals.overdueReceivables.count} piutang melewati jatuh tempo`,
      context: `${formatRupiah(signals.overdueReceivables.total)} belum menjadi kas`,
      domain: "Keuangan",
      actionLabel: "Tagih",
      href: "/keuangan",
      severity: "critical",
      priority: 30,
    });
  }

  const emptyStockCount = lowStock.filter((item) => item.stock <= 0).length;
  if (lowStock.length > 0) {
    items.push({
      id: "low-stock",
      title: emptyStockCount > 0
        ? `${emptyStockCount} stok kosong menghambat operasi`
        : `${lowStock.length} stok berada di bawah batas aman`,
      context: lowStock
        .slice(0, 2)
        .map((item) => `${item.name} ${item.stock.toLocaleString("id-ID")} ${item.unit}`)
        .join(" · "),
      domain: "Pasokan",
      actionLabel: "Pulihkan stok",
      href: "/inventory?metric=low",
      severity: emptyStockCount > 0 ? "critical" : "warning",
      priority: emptyStockCount > 0 ? 40 : 80,
    });
  }

  for (const [index, action] of dailyActions.entries()) {
    if (action.href !== "/audit" || action.severity === "INFO") continue;
    items.push({
      id: `integration-${index}`,
      title: action.label,
      context: "Sinkronisasi data perlu diperiksa sebelum operasi dilanjutkan",
      domain: "Integrasi",
      actionLabel: "Periksa",
      href: action.href,
      severity: action.severity === "CRITICAL" ? "critical" : "warning",
      priority: 50,
    });
  }

  if (signals.fulfillmentReadyToPack > 0 || signals.fulfillmentPacked > 0) {
    const parts = [
      signals.fulfillmentReadyToPack > 0 ? `${signals.fulfillmentReadyToPack} siap dikemas` : null,
      signals.fulfillmentPacked > 0 ? `${signals.fulfillmentPacked} siap dikirim` : null,
    ].filter(Boolean);
    items.push({
      id: "fulfillment-dispatch",
      title: `${signals.fulfillmentReadyToPack + signals.fulfillmentPacked} pesanan siap diteruskan`,
      context: parts.join(" · "),
      domain: "Fulfillment",
      actionLabel: "Proses",
      href: "/penjualan/fulfillment",
      severity: "warning",
      priority: 60,
    });
  }

  if (signals.purchaseOrdersToReceive > 0) {
    items.push({
      id: "purchase-orders-receiving",
      title: `${signals.purchaseOrdersToReceive} PO menunggu penerimaan`,
      context: "Catat barang datang agar stok dan hutang supplier ikut diperbarui",
      domain: "Pasokan",
      actionLabel: "Terima barang",
      href: "/inventory?view=receiving",
      severity: "warning",
      priority: 70,
    });
  }

  if (signals.roastingBatchesOpen > 0) {
    items.push({
      id: "roasting-open",
      title: `${signals.roastingBatchesOpen} batch roasting belum diselesaikan`,
      context: "Selesaikan batch agar hasil roasted bean masuk ke stok",
      domain: "Roastery",
      actionLabel: "Selesaikan",
      href: "/roasting",
      severity: "warning",
      priority: 90,
    });
  }

  return items
    .sort((a, b) => a.priority - b.priority)
    .slice(0, limit);
}
