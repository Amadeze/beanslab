import { describe, expect, it } from "vitest";
import {
  canReviewPayment,
  canSubmitPaymentProof,
  paymentDestinationSnapshot,
  toPublicPaymentMethod,
  validatePaymentReview,
} from "./manual-payments";

describe("manual payment workflow", () => {
  const method = {
    id: "method-1",
    provider: "MANUAL" as const,
    method: "TRANSFER" as const,
    label: "BCA Operasional",
    bankName: "BCA",
    accountNumber: "1234567890",
    accountHolder: "PT Roastd",
    qrisImageUrl: null,
    instructions: "Cantumkan nomor invoice.",
    requireProof: true,
    isActive: true,
  };

  it("only exposes checkout-safe payment method fields", () => {
    expect(toPublicPaymentMethod(method)).toEqual({
      id: "method-1",
      provider: "MANUAL",
      method: "TRANSFER",
      label: "BCA Operasional",
      bankName: "BCA",
      accountNumber: "1234567890",
      accountHolder: "PT Roastd",
      qrisImageUrl: null,
      instructions: "Cantumkan nomor invoice.",
      requireProof: true,
    });
  });

  it("freezes destination details for an existing order", () => {
    expect(paymentDestinationSnapshot(toPublicPaymentMethod(method))).toEqual({
      label: "BCA Operasional",
      bankName: "BCA",
      accountNumber: "1234567890",
      accountHolder: "PT Roastd",
      qrisImageUrl: null,
      instructions: "Cantumkan nomor invoice.",
    });
  });

  it("never treats an uploaded proof as reviewed", () => {
    expect(canSubmitPaymentProof("AWAITING_PROOF")).toBe(true);
    expect(canSubmitPaymentProof("REJECTED")).toBe(true);
    expect(canReviewPayment("AWAITING_VERIFICATION")).toBe(true);
    expect(canReviewPayment("VERIFIED")).toBe(false);
  });

  it("allows a real partial payment", () => {
    expect(validatePaymentReview({
      outstanding: 1_000_000,
      declaredAmount: 400_000,
      appliedAmount: 400_000,
      suspectedDuplicate: false,
      duplicateConfirmed: false,
    })).toBeNull();
  });

  it("blocks overpayments until refund handling is resolved", () => {
    expect(validatePaymentReview({
      outstanding: 1_000_000,
      declaredAmount: 1_100_000,
      appliedAmount: 1_000_000,
      suspectedDuplicate: false,
      duplicateConfirmed: false,
    })).toContain("kelebihan dana");
  });

  it("requires explicit review of suspected duplicates", () => {
    expect(validatePaymentReview({
      outstanding: 1_000_000,
      declaredAmount: 500_000,
      appliedAmount: 500_000,
      suspectedDuplicate: true,
      duplicateConfirmed: false,
    })).toContain("duplikat");
  });
});
