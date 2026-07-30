export type XenditPaymentRequestInput = {
  referenceId: string;
  amount: number;
  channelCode: string;
  channelProperties: Record<string, unknown>;
  subAccountId?: string;
  country?: "ID";
  currency?: "IDR";
  description?: string;
  metadata?: Record<string, unknown>;
};

export type XenditPaymentRequest = {
  payment_request_id: string;
  reference_id: string;
  status: string;
  request_amount: number;
  actions?: Array<{ action: string; url?: string; qr_string?: string }>;
  [key: string]: unknown;
};

export class XenditProviderError extends Error {
  constructor(message: string, readonly status: number, readonly payload?: unknown) {
    super(message);
    this.name = "XenditProviderError";
  }
}

export async function createXenditPaymentRequest(
  input: XenditPaymentRequestInput,
  options: {
    secretKey?: string;
    fetch?: typeof fetch;
    apiBaseUrl?: string;
  } = {},
): Promise<XenditPaymentRequest> {
  const secretKey = options.secretKey || process.env.XENDIT_SECRET_KEY;
  if (!secretKey) throw new Error("XENDIT_SECRET_KEY belum dikonfigurasi.");
  if (!input.referenceId.trim()) throw new Error("referenceId wajib diisi.");
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("amount harus lebih dari nol.");
  if (!input.channelCode.trim()) throw new Error("channelCode wajib diisi.");

  const response = await (options.fetch || fetch)(
    `${(options.apiBaseUrl || "https://api.xendit.co").replace(/\/$/, "")}/v3/payment_requests`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
        "Content-Type": "application/json",
        "api-version": "2024-11-11",
        "idempotency-key": input.referenceId,
        ...(input.subAccountId ? { "for-user-id": input.subAccountId } : {}),
      },
      body: JSON.stringify({
        reference_id: input.referenceId,
        type: "PAY",
        country: input.country || "ID",
        currency: input.currency || "IDR",
        request_amount: input.amount,
        capture_method: "AUTOMATIC",
        channel_code: input.channelCode,
        channel_properties: input.channelProperties,
        ...(input.description ? { description: input.description } : {}),
        ...(input.metadata ? { metadata: input.metadata } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "message" in payload
      ? String(payload.message)
      : `Xendit menolak request (${response.status}).`;
    throw new XenditProviderError(message, response.status, payload);
  }
  return payload as XenditPaymentRequest;
}
