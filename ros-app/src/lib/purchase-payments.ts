import { getCurrentDate } from "@/lib/date-utils";
export type PurchasePaymentState = "UNPAID" | "PARTIAL" | "PAID";
export type PayableAgingBucket =
  | "CURRENT"
  | "OVERDUE_1_30"
  | "OVERDUE_31_60"
  | "OVERDUE_61_PLUS";

export function resolveInitialPurchasePayment(
  totalCost: number,
  requestedStatus: PurchasePaymentState | undefined,
  requestedPaidAmount: number | undefined,
) {
  if (!Number.isFinite(totalCost) || totalCost <= 0) {
    throw new Error("Total pembelian harus lebih dari 0.");
  }

  const paymentStatus = requestedStatus ?? "PAID";
  if (paymentStatus === "PAID") {
    return { paymentStatus, paidAmount: totalCost };
  }
  if (paymentStatus === "UNPAID") {
    return { paymentStatus, paidAmount: 0 };
  }

  const paidAmount = requestedPaidAmount ?? 0;
  if (!Number.isFinite(paidAmount) || paidAmount <= 0 || paidAmount >= totalCost - 0.01) {
    throw new Error("Uang muka harus lebih dari 0 dan lebih kecil dari total pembelian.");
  }
  return { paymentStatus, paidAmount };
}

export function getPurchasePaymentStatus(
  paidAmount: number,
  totalCost: number,
): PurchasePaymentState {
  if (paidAmount <= 0.01) return "UNPAID";
  if (paidAmount >= totalCost - 0.01) return "PAID";
  return "PARTIAL";
}

/** Derive accounting state from the one fact the user knows: how much was paid. */
export function resolvePurchasePaymentFromAmount(
  totalCost: number,
  requestedPaidAmount: number | undefined,
) {
  if (!Number.isFinite(totalCost) || totalCost <= 0) {
    throw new Error("Total pembelian harus lebih dari 0.");
  }
  const paidAmount = requestedPaidAmount ?? totalCost;
  if (!Number.isFinite(paidAmount) || paidAmount < 0) {
    throw new Error("Jumlah dibayar tidak valid.");
  }
  if (paidAmount > totalCost + 0.01) {
    throw new Error("Jumlah dibayar tidak boleh melebihi total pembelian.");
  }
  const normalizedPaidAmount = Math.min(paidAmount, totalCost);
  return {
    paymentStatus: getPurchasePaymentStatus(normalizedPaidAmount, totalCost),
    paidAmount: normalizedPaidAmount,
    balance: Math.max(0, totalCost - normalizedPaidAmount),
  };
}

export function getPayableAgingBucket(
  dueDate: Date | null,
  asOf = getCurrentDate(),
): PayableAgingBucket {
  if (!dueDate || dueDate >= asOf) return "CURRENT";
  const daysOverdue = Math.max(
    1,
    Math.ceil((asOf.getTime() - dueDate.getTime()) / 86_400_000),
  );
  if (daysOverdue <= 30) return "OVERDUE_1_30";
  if (daysOverdue <= 60) return "OVERDUE_31_60";
  return "OVERDUE_61_PLUS";
}

export type ReceivableAgingBucket =
  | "CURRENT"
  | "OVERDUE_1_30"
  | "OVERDUE_31_60"
  | "OVERDUE_61_PLUS";

export function getReceivableAgingBucket(
  dueDate: Date | null,
  asOf = getCurrentDate(),
): ReceivableAgingBucket {
  if (!dueDate || dueDate >= asOf) return "CURRENT";
  const daysOverdue = Math.max(
    1,
    Math.ceil((asOf.getTime() - dueDate.getTime()) / 86_400_000),
  );
  if (daysOverdue <= 30) return "OVERDUE_1_30";
  if (daysOverdue <= 60) return "OVERDUE_31_60";
  return "OVERDUE_61_PLUS";
}
