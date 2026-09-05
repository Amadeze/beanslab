import { describe, expect, it } from "vitest";
import { deriveMidtransEventId, isSuccessfulPayment } from "./midtransWebhookDedupe";

describe("deriveMidtransEventId", () => {
  it("produces a stable id for the same (orderId, status, transactionId) tuple", () => {
    const a = deriveMidtransEventId({
      orderId: "INV-001",
      transactionStatus: "settlement",
      transactionId: "tx-abc",
    });
    const b = deriveMidtransEventId({
      orderId: "INV-001",
      transactionStatus: "settlement",
      transactionId: "tx-abc",
    });
    expect(a).toBe(b);
  });

  it("differs when the transactionId differs", () => {
    const a = deriveMidtransEventId({
      orderId: "INV-001",
      transactionStatus: "settlement",
      transactionId: "tx-1",
    });
    const b = deriveMidtransEventId({
      orderId: "INV-001",
      transactionStatus: "settlement",
      transactionId: "tx-2",
    });
    expect(a).not.toBe(b);
  });

  it("differs when the transaction status differs", () => {
    const a = deriveMidtransEventId({
      orderId: "INV-001",
      transactionStatus: "settlement",
      transactionId: "tx-abc",
    });
    const b = deriveMidtransEventId({
      orderId: "INV-001",
      transactionStatus: "capture",
      transactionId: "tx-abc",
    });
    expect(a).not.toBe(b);
  });

  it("falls back to statusCode when no transactionId is provided", () => {
    const a = deriveMidtransEventId({
      orderId: "INV-001",
      transactionStatus: "settlement",
      statusCode: "200",
    });
    const b = deriveMidtransEventId({
      orderId: "INV-001",
      transactionStatus: "settlement",
      statusCode: "200",
    });
    expect(a).toBe(b);
    expect(a).toContain("INV-001");
    expect(a).toContain("settlement");
  });

  it("default status is 'unknown' when neither status nor code is provided", () => {
    const id = deriveMidtransEventId({ orderId: "INV-001" });
    expect(id).toBe("INV-001:unknown:unknown");
  });
});

describe("isSuccessfulPayment", () => {
  it("treats settlement, capture, and accept as successful", () => {
    expect(isSuccessfulPayment("settlement", "accept")).toBe(true);
    expect(isSuccessfulPayment("capture", "accept")).toBe(true);
    expect(isSuccessfulPayment("settlement", "challenge")).toBe(false);
  });

  it("treats deny fraud_status as unsuccessful regardless of transaction_status", () => {
    expect(isSuccessfulPayment("settlement", "deny")).toBe(false);
    expect(isSuccessfulPayment("capture", "deny")).toBe(false);
  });

  it("treats pending/cancel/expire/fail as unsuccessful", () => {
    expect(isSuccessfulPayment("pending", "accept")).toBe(false);
    expect(isSuccessfulPayment("cancel", "accept")).toBe(false);
    expect(isSuccessfulPayment("expire", "accept")).toBe(false);
    expect(isSuccessfulPayment("failure", "accept")).toBe(false);
  });
});