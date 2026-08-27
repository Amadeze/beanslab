import { describe, expect, it } from "vitest";

import {
  getPayableAgingBucket,
  getPurchasePaymentStatus,
  resolveInitialPurchasePayment,
  resolvePurchasePaymentFromAmount,
} from "./purchase-payments";

describe("resolveInitialPurchasePayment", () => {
  it("keeps existing purchases cash-compatible by default", () => {
    expect(resolveInitialPurchasePayment(150_000, undefined, undefined)).toEqual({
      paymentStatus: "PAID",
      paidAmount: 150_000,
    });
  });

  it("supports unpaid and partial purchases", () => {
    expect(resolveInitialPurchasePayment(150_000, "UNPAID", undefined)).toEqual({
      paymentStatus: "UNPAID",
      paidAmount: 0,
    });
    expect(resolveInitialPurchasePayment(150_000, "PARTIAL", 50_000)).toEqual({
      paymentStatus: "PARTIAL",
      paidAmount: 50_000,
    });
  });

  it("rejects invalid partial amounts", () => {
    expect(() => resolveInitialPurchasePayment(150_000, "PARTIAL", 0)).toThrow();
    expect(() => resolveInitialPurchasePayment(150_000, "PARTIAL", 150_000)).toThrow();
  });
});

describe("getPurchasePaymentStatus", () => {
  it("derives status using currency tolerance", () => {
    expect(getPurchasePaymentStatus(0, 100)).toBe("UNPAID");
    expect(getPurchasePaymentStatus(50, 100)).toBe("PARTIAL");
    expect(getPurchasePaymentStatus(99.995, 100)).toBe("PAID");
  });
});

describe("resolvePurchasePaymentFromAmount", () => {
  it("derives paid, partial, and unpaid state without asking the user for a status", () => {
    expect(resolvePurchasePaymentFromAmount(150_000, 150_000)).toEqual({
      paymentStatus: "PAID", paidAmount: 150_000, balance: 0,
    });
    expect(resolvePurchasePaymentFromAmount(150_000, 50_000)).toEqual({
      paymentStatus: "PARTIAL", paidAmount: 50_000, balance: 100_000,
    });
    expect(resolvePurchasePaymentFromAmount(150_000, 0)).toEqual({
      paymentStatus: "UNPAID", paidAmount: 0, balance: 150_000,
    });
  });

  it("rejects overpayment", () => {
    expect(() => resolvePurchasePaymentFromAmount(150_000, 150_001)).toThrow(/melebihi/);
  });
});

describe("getPayableAgingBucket", () => {
  const asOf = new Date("2026-07-16T12:00:00Z");

  it("groups current and overdue balances", () => {
    expect(getPayableAgingBucket(null, asOf)).toBe("CURRENT");
    expect(getPayableAgingBucket(new Date("2026-07-20T00:00:00Z"), asOf)).toBe("CURRENT");
    expect(getPayableAgingBucket(new Date("2026-07-01T00:00:00Z"), asOf)).toBe("OVERDUE_1_30");
    expect(getPayableAgingBucket(new Date("2026-06-01T00:00:00Z"), asOf)).toBe("OVERDUE_31_60");
    expect(getPayableAgingBucket(new Date("2026-04-01T00:00:00Z"), asOf)).toBe("OVERDUE_61_PLUS");
  });
});
