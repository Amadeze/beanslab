export interface MidtransEventIdInput {
  orderId: string;
  transactionStatus?: string | null;
  transactionId?: string | null;
  statusCode?: string | null;
}

export function deriveMidtransEventId(input: MidtransEventIdInput): string {
  const status = input.transactionStatus || "unknown";
  const discriminator = input.transactionId || input.statusCode || "unknown";
  return `${input.orderId}:${status}:${discriminator}`;
}

export function isSuccessfulPayment(
  transactionStatus: string | null | undefined,
  fraudStatus: string | null | undefined,
): boolean {
  if (fraudStatus && fraudStatus !== "accept") return false;
  if (!transactionStatus) return false;
  return transactionStatus === "settlement" || transactionStatus === "capture";
}