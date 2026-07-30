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
    expect(items[0]).toMatchObject({ actionLabel: "Periksa", severity: "critical" });
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
});
