import { describe, expect, it } from "vitest";
import { buildDashboardWorkItems, type DashboardQueueSignals } from "./dashboard-work-queue";

const emptySignals: DashboardQueueSignals = {
  purchaseOrdersToReceive: 0,
  roastingBatchesOpen: 0,
  paymentReviews: 0,
  fulfillmentNeedsProduction: 0,
  fulfillmentReadyToPack: 0,
  fulfillmentPacked: 0,
  overdueReceivables: { count: 0, total: 0 },
};

describe("buildDashboardWorkItems", () => {
  it("prioritizes blocked cash and production before routine work", () => {
    const items = buildDashboardWorkItems({
      signals: {
        ...emptySignals,
        paymentReviews: 2,
        fulfillmentNeedsProduction: 3,
        purchaseOrdersToReceive: 4,
        roastingBatchesOpen: 1,
      },
      lowStock: [],
    });

    expect(items.map((item) => item.id)).toEqual([
      "payment-reviews",
      "fulfillment-production",
      "purchase-orders-receiving",
      "roasting-open",
    ]);
    expect(items[0]).toMatchObject({
      type: "PAYMENT_REVIEW",
      sourceType: "PAYMENT_SUBMISSION",
      sourceId: "payment-reviews",
      status: "READY",
      actionLabel: "Periksa",
      severity: "critical",
    });
    expect(items[1]).toMatchObject({
      type: "PRODUCE",
      status: "BLOCKED",
      blocker: "Stok barang jadi belum cukup untuk memenuhi pesanan",
    });
  });

  it("promotes empty stock to critical and keeps stale brief actions out of the queue", () => {
    const items = buildDashboardWorkItems({
      signals: emptySignals,
      lowStock: [{ id: "gb-1", name: "Gayo", stock: 0, unit: "kg", threshold: 5 }],
      dailyActions: [
        { severity: "CRITICAL", label: "Piutang lama", href: "/keuangan" },
        { severity: "CRITICAL", label: "Webhook gagal", href: "/audit" },
      ],
    });

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ id: "low-stock", severity: "critical" });
    expect(items[1]).toMatchObject({ id: "integration-1", domain: "Integrasi" });
  });

  it("returns an empty queue when every operational signal is clear", () => {
    expect(buildDashboardWorkItems({ signals: emptySignals, lowStock: [] })).toEqual([]);
  });

  it("keeps packing and handover as separate next actions", () => {
    const items = buildDashboardWorkItems({
      signals: { ...emptySignals, fulfillmentReadyToPack: 2, fulfillmentPacked: 3 },
      lowStock: [],
    });

    expect(items.map((item) => item.id)).toEqual([
      "fulfillment-pack",
      "fulfillment-handover",
    ]);
    expect(items[0]).toMatchObject({ type: "PACK", status: "READY", actionLabel: "Kemas" });
    expect(items[1]).toMatchObject({ type: "HANDOVER", status: "READY", actionLabel: "Serahkan" });
  });

  it("shows each role only the work they can actually perform", () => {
    const signals = {
      ...emptySignals,
      paymentReviews: 1,
      fulfillmentNeedsProduction: 1,
      fulfillmentReadyToPack: 1,
      fulfillmentPacked: 1,
      purchaseOrdersToReceive: 1,
      roastingBatchesOpen: 1,
      overdueReceivables: { count: 1, total: 500_000 },
    };

    const operatorItems = buildDashboardWorkItems({ signals, lowStock: [], role: "OPERATOR" });
    const cashierItems = buildDashboardWorkItems({ signals, lowStock: [], role: "CASHIER" });

    expect(operatorItems.map((item) => item.type)).toEqual([
      "PRODUCE",
      "PACK",
      "HANDOVER",
      "RECEIVE",
      "ROAST",
    ]);
    expect(cashierItems.map((item) => item.type)).toEqual([
      "PAYMENT_REVIEW",
      "COLLECT_PAYMENT",
      "PACK",
      "HANDOVER",
    ]);
  });
});
