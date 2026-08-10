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
  type: "PAYMENT_REVIEW" | "PRODUCE" | "COLLECT_PAYMENT" | "RESTOCK" | "INTEGRATION_REVIEW" | "PACK" | "HANDOVER" | "RECEIVE" | "ROAST";
  sourceType: "PAYMENT_SUBMISSION" | "FULFILLMENT" | "INVOICE" | "INVENTORY" | "INTEGRATION" | "PURCHASE_ORDER" | "ROAST_BATCH";
  sourceId: string;
  status: "READY" | "BLOCKED" | "IN_PROGRESS";
  blocker?: string;
  title: string;
  context: string;
  domain: string;
  actionLabel: string;
  href: string;
  severity: "critical" | "warning";
};

export type DashboardWorkRole = "OWNER" | "MANAGER" | "OPERATOR" | "CASHIER";

type RankedWorkItem = DashboardWorkItem & { priority: number };

export function buildDashboardWorkItems({
  signals,
  lowStock,
  dailyActions = [],
  limit = 7,
  role = "OWNER",
}: {
  signals: DashboardQueueSignals;
  lowStock: DashboardQueueStockItem[];
  dailyActions?: DashboardQueueBriefAction[];
  limit?: number;
  role?: DashboardWorkRole;
}): DashboardWorkItem[] {
  const items: RankedWorkItem[] = [];

  if (signals.paymentReviews > 0) {
    items.push({
      id: "payment-reviews",
      type: "PAYMENT_REVIEW",
      sourceType: "PAYMENT_SUBMISSION",
      sourceId: "payment-reviews",
      status: "READY",
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
      type: "PRODUCE",
      sourceType: "FULFILLMENT",
      sourceId: "fulfillment-production",
      status: "BLOCKED",
      blocker: "Stok barang jadi belum cukup untuk memenuhi pesanan",
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
      type: "COLLECT_PAYMENT",
      sourceType: "INVOICE",
      sourceId: "overdue-receivables",
      status: "READY",
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
      type: "RESTOCK",
      sourceType: "INVENTORY",
      sourceId: "low-stock",
      status: "BLOCKED",
      blocker: emptyStockCount > 0 ? "Stok kosong menghambat operasi" : "Stok berada di bawah batas aman",
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
      type: "INTEGRATION_REVIEW",
      sourceType: "INTEGRATION",
      sourceId: `integration-${index}`,
      status: "BLOCKED",
      blocker: "Sinkronisasi data perlu diperiksa sebelum operasi dilanjutkan",
      title: action.label,
      context: "Sinkronisasi data perlu diperiksa sebelum operasi dilanjutkan",
      domain: "Integrasi",
      actionLabel: "Periksa",
      href: action.href,
      severity: action.severity === "CRITICAL" ? "critical" : "warning",
      priority: 50,
    });
  }

  if (signals.fulfillmentReadyToPack > 0) {
    items.push({
      id: "fulfillment-pack",
      type: "PACK",
      sourceType: "FULFILLMENT",
      sourceId: "fulfillment-pack",
      status: "READY",
      title: `${signals.fulfillmentReadyToPack} pesanan siap dikemas`,
      context: "Barang sudah tersedia dan menunggu proses packing",
      domain: "Fulfillment",
      actionLabel: "Kemas",
      href: "/penjualan/fulfillment",
      severity: "warning",
      priority: 60,
    });
  }

  if (signals.fulfillmentPacked > 0) {
    items.push({
      id: "fulfillment-handover",
      type: "HANDOVER",
      sourceType: "FULFILLMENT",
      sourceId: "fulfillment-handover",
      status: "READY",
      title: `${signals.fulfillmentPacked} pesanan siap diserahkan`,
      context: "Konfirmasi pickup atau pengiriman untuk menyelesaikan pesanan",
      domain: "Fulfillment",
      actionLabel: "Serahkan",
      href: "/penjualan/fulfillment",
      severity: "warning",
      priority: 65,
    });
  }

  if (signals.purchaseOrdersToReceive > 0) {
    items.push({
      id: "purchase-orders-receiving",
      type: "RECEIVE",
      sourceType: "PURCHASE_ORDER",
      sourceId: "purchase-orders-receiving",
      status: "READY",
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
      type: "ROAST",
      sourceType: "ROAST_BATCH",
      sourceId: "roasting-open",
      status: "IN_PROGRESS",
      title: `${signals.roastingBatchesOpen} batch roasting belum diselesaikan`,
      context: "Selesaikan batch agar hasil roasted bean masuk ke stok",
      domain: "Roastery",
      actionLabel: "Selesaikan",
      href: "/roasting",
      severity: "warning",
      priority: 90,
    });
  }

  const allowedTypes: Record<DashboardWorkRole, DashboardWorkItem["type"][] | null> = {
    OWNER: null,
    MANAGER: null,
    OPERATOR: ["PRODUCE", "RESTOCK", "PACK", "HANDOVER", "RECEIVE", "ROAST"],
    CASHIER: ["PAYMENT_REVIEW", "COLLECT_PAYMENT", "PACK", "HANDOVER"],
  };
  const roleTypes = allowedTypes[role];

  return items
    .filter((item) => roleTypes === null || roleTypes.includes(item.type))
    .sort((a, b) => a.priority - b.priority)
    .slice(0, limit);
}
