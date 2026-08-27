import type { PaymentMethod, PaymentProvider, PaymentSubmissionStatus } from "@prisma/client";

export type PublicPaymentMethod = {
  id: string;
  provider: PaymentProvider;
  method: PaymentMethod;
  label: string;
  bankName: string | null;
  accountNumber: string | null;
  accountHolder: string | null;
  qrisImageUrl: string | null;
  instructions: string | null;
  requireProof: boolean;
};

type PaymentMethodSource = PublicPaymentMethod & { isActive?: boolean };

export function toPublicPaymentMethod(source: PaymentMethodSource): PublicPaymentMethod {
  return {
    id: source.id,
    provider: source.provider,
    method: source.method,
    label: source.label,
    bankName: source.bankName,
    accountNumber: source.accountNumber,
    accountHolder: source.accountHolder,
    qrisImageUrl: source.qrisImageUrl,
    instructions: source.instructions,
    requireProof: source.requireProof,
  };
}

export function paymentDestinationSnapshot(method: PublicPaymentMethod) {
  return {
    label: method.label,
    bankName: method.bankName,
    accountNumber: method.accountNumber,
    accountHolder: method.accountHolder,
    qrisImageUrl: method.qrisImageUrl,
    instructions: method.instructions,
  };
}

export function canSubmitPaymentProof(status: PaymentSubmissionStatus) {
  return status === "AWAITING_PROOF" || status === "REJECTED";
}

export function canReviewPayment(status: PaymentSubmissionStatus) {
  return status === "AWAITING_VERIFICATION";
}

export function validatePaymentReview(input: {
  outstanding: number;
  declaredAmount: number;
  appliedAmount: number;
  suspectedDuplicate: boolean;
  duplicateConfirmed: boolean;
}): string | null {
  if (!Number.isFinite(input.appliedAmount) || input.appliedAmount <= 0) {
    return "Nominal yang diterapkan harus lebih dari nol.";
  }
  if (input.outstanding <= 0) return "Invoice sudah lunas.";
  if (input.suspectedDuplicate && !input.duplicateConfirmed) {
    return "Bukti terindikasi duplikat. Periksa bukti pembanding dan konfirmasi secara eksplisit.";
  }
  if (input.declaredAmount > input.outstanding + 0.01) {
    return "Nominal transfer melebihi sisa tagihan. Selesaikan pengembalian kelebihan dana sebelum verifikasi.";
  }
  if (input.appliedAmount > input.declaredAmount + 0.01) {
    return "Nominal diterapkan tidak boleh melebihi nominal yang benar-benar ditransfer.";
  }
  if (input.appliedAmount > input.outstanding + 0.01) {
    return "Nominal diterapkan melebihi sisa tagihan invoice.";
  }
  return null;
}

export function paymentStatusLabel(status: PaymentSubmissionStatus) {
  return {
    AWAITING_PROOF: "Menunggu pembayaran",
    AWAITING_VERIFICATION: "Menunggu verifikasi",
    VERIFIED: "Pembayaran terverifikasi",
    REJECTED: "Bukti perlu diperbaiki",
    EXPIRED: "Pesanan kedaluwarsa",
  }[status];
}
