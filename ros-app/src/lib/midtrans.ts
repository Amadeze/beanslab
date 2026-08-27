/**
 * Wrapper for Midtrans Snap API using standard fetch
 */

export interface SnapTransactionParams {
  order_id: string;
  gross_amount: number;
  customer_details?: {
    first_name: string;
    phone?: string;
    email?: string;
  };
  item_details?: Array<{
    id: string;
    price: number;
    quantity: number;
    name: string;
  }>;
}

export interface SnapResponse {
  token: string;
  redirect_url: string;
}

export async function createMidtransSnapTransaction(
  serverKey: string,
  isProduction: boolean,
  params: SnapTransactionParams
): Promise<SnapResponse> {
  const apiUrl = isProduction
    ? "https://app.midtrans.com/snap/v1/transactions"
    : "https://app.sandbox.midtrans.com/snap/v1/transactions";

  const authString = Buffer.from(serverKey + ":").toString("base64");

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Basic ${authString}`,
    },
    body: JSON.stringify({
      transaction_details: {
        order_id: params.order_id,
        gross_amount: Math.round(params.gross_amount),
      },
      customer_details: params.customer_details,
      item_details: params.item_details,
    }),
  });

  if (!res.ok) {
    // Never log or forward the raw gateway response: it may carry
    // transaction details. Only the sanitized HTTP status travels.
    await res.text().catch(() => undefined);
    throw new Error(`Midtrans API failed with status ${res.status}`);
  }

  return await res.json();
}
