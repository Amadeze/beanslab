/**
 * Midtrans Server-Side Gateway Helpers
 *
 * Narrow, server-only helpers for Midtrans Snap transaction lifecycle.
 * No external HTTP inside Serializable DB transactions.
 * Used for: initialization, status lookup, recovery.
 */

import midtransClient from "midtrans-client";
import { decryptCredential } from "@/lib/credentials";

export interface MidtransStatusResult {
  status: "EXISTS_ACTIVE" | "EXISTS_PAID" | "EXISTS_TERMINAL" | "NOT_FOUND" | "UPSTREAM_AMBIGUOUS";
  redirectUrl?: string;
  token?: string;
  grossAmount?: number;
  transactionStatus?: string;
  rawResponse?: unknown;
}

export interface MidtransInitResult {
  success: boolean;
  token?: string;
  redirectUrl?: string;
  error?: string;
  statusCode?: number;
}

/**
 * Create Midtrans Snap client for a tenant
 */
function createSnapClient(tenant: { midtransServerKey: string; midtransClientKey: string; midtransIsProduction: boolean }) {
  const serverKey = decryptCredential(tenant.midtransServerKey);
  return new midtransClient.Snap({
    isProduction: tenant.midtransIsProduction,
    serverKey,
    clientKey: tenant.midtransClientKey || "",
  });
}

/**
 * Initialize a Snap transaction (idempotent by order_id)
 */
export async function initializeMidtransSnap(
  tenant: { midtransServerKey: string; midtransClientKey: string; midtransIsProduction: boolean },
  params: {
    order_id: string;
    gross_amount: number;
    customer_details: { first_name: string; phone?: string; email?: string };
    item_details: Array<{ id: string; price: number; quantity: number; name: string }>;
  }
): Promise<MidtransInitResult> {
  try {
    const snap = createSnapClient(tenant);
    // Type cast to satisfy midtrans-client SnapTransactionParameters
    const parameter = {
      transaction_details: {
        order_id: params.order_id,
        gross_amount: Math.round(params.gross_amount),
      },
      customer_details: params.customer_details,
      item_details: params.item_details,
    } as midtransClient.SnapTransactionParameters & { customer_details: unknown };

    const transaction = await snap.createTransaction(parameter);
    return {
      success: true,
      token: transaction.token,
      redirectUrl: transaction.redirect_url,
    };
  } catch (err: unknown) {
    const error = err as { response?: { status?: number; data?: unknown }; message?: string };
    return {
      success: false,
      error: error.message || "Midtrans initialization failed",
      statusCode: error.response?.status,
    };
  }
}

/**
 * Get Midtrans transaction status for reconciliation
 *
 * Uses GET /v2/{order_id}/status endpoint (Core API)
 * Returns classified status for recovery decisions
 */
export async function getMidtransTransactionStatus(
  tenant: { midtransServerKey: string; midtransIsProduction: boolean },
  orderId: string
): Promise<MidtransStatusResult> {
  try {
    const serverKey = decryptCredential(tenant.midtransServerKey);
    const apiUrl = tenant.midtransIsProduction
      ? `https://api.midtrans.com/v2/${orderId}/status`
      : `https://api.sandbox.midtrans.com/v2/${orderId}/status`;

    const authString = Buffer.from(serverKey + ":").toString("base64");
    const res = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${authString}`,
      },
    });

    if (!res.ok) {
      if (res.status === 404) {
        return { status: "NOT_FOUND" };
      }
      // Any other HTTP error = ambiguous upstream
      return {
        status: "UPSTREAM_AMBIGUOUS",
        rawResponse: await res.text().catch(() => undefined),
      };
    }

    const data = await res.json();

    // Map Midtrans transaction_status to our classification
    // Reference: https://docs.midtrans.com/reference/get-transaction-status
    const ts = data.transaction_status;
    const redirectUrl = data.redirect_url;
    const token = data.token;

    // Terminal states (paid/settlement/capture)
    if (["settlement", "capture"].includes(ts)) {
      return { status: "EXISTS_PAID", redirectUrl, token, grossAmount: data.gross_amount, transactionStatus: ts };
    }

    // Active/pending states where customer can still pay
    if (["pending", "authorize"].includes(ts)) {
      return { status: "EXISTS_ACTIVE", redirectUrl, token, grossAmount: data.gross_amount, transactionStatus: ts };
    }

    // Terminal failure states
    if (["cancel", "deny", "expire", "failure"].includes(ts)) {
      return { status: "EXISTS_TERMINAL", redirectUrl, token, grossAmount: data.gross_amount, transactionStatus: ts };
    }

    // Unknown status - treat as ambiguous
    return {
      status: "UPSTREAM_AMBIGUOUS",
      redirectUrl,
      token,
      grossAmount: data.gross_amount,
      transactionStatus: ts
    };
  } catch (err) {
    // Network error, timeout, etc. = ambiguous
    return {
      status: "UPSTREAM_AMBIGUOUS",
      rawResponse: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Recover or initialize Midtrans transaction for a committed invoice
 *
 * Implements Windows A/B/C recovery logic:
 * - Window A: local invoice, no gateway transaction → initialize
 * - Window B: gateway transaction exists → recover/reconcile
 * - Window C: ambiguous → status lookup first, then decide
 */
export async function recoverOrInitializeMidtrans(
  tenant: { midtransServerKey: string; midtransClientKey: string; midtransIsProduction: boolean },
  invoice: {
    id: string;
    code: string;
    midtransOrderId: string | null;
    paymentUrl: string | null;
    snapToken: string | null;
    grandTotal: number;
    customerName: string;
    customerPhone: string;
    customerEmail: string | null;
    itemDetails: Array<{ id: string; price: number; quantity: number; name: string }>;
  }
): Promise<{ paymentUrl: string | null; snapToken: string | null; action: "initialized" | "recovered" | "paid" | "terminal" | "ambiguous" | "noop" }> {

  const orderId = invoice.midtransOrderId;
  if (!orderId) {
    return { paymentUrl: null, snapToken: null, action: "noop" };
  }

  // Window D: already has valid paymentUrl
  if (invoice.paymentUrl && invoice.snapToken) {
    return { paymentUrl: invoice.paymentUrl, snapToken: invoice.snapToken, action: "noop" };
  }

  // Try status lookup first (handles Windows A/B/C)
  const statusResult = await getMidtransTransactionStatus(tenant, orderId);

  switch (statusResult.status) {
    case "EXISTS_PAID":
      // Window B: remote already paid
      // Do NOT create new Snap. Return existing state.
      // Payment/webhook canonical path handles the rest.
      return {
        paymentUrl: invoice.paymentUrl,
        snapToken: invoice.snapToken,
        action: "paid"
      };

    case "EXISTS_ACTIVE":
      // Window B: remote transaction active but local URL/token lost
      // Try to get a new Snap token for the SAME order_id
      // Per Midtrans docs: createTransaction with same order_id returns new token
      const initResultActive = await initializeMidtransSnap(tenant, {
        order_id: orderId,
        gross_amount: Math.round(invoice.grandTotal),
        customer_details: {
          first_name: invoice.customerName,
          phone: invoice.customerPhone,
          email: invoice.customerEmail || undefined,
        },
        item_details: invoice.itemDetails,
      });

      if (initResultActive.success) {
        return {
          paymentUrl: initResultActive.redirectUrl!,
          snapToken: initResultActive.token!,
          action: "recovered"
        };
      }

      // If re-init failed, return whatever we had (might be null)
      return {
        paymentUrl: invoice.paymentUrl || statusResult.redirectUrl || null,
        snapToken: invoice.snapToken || statusResult.token || null,
        action: "ambiguous"
      };

    case "EXISTS_TERMINAL":
      // Window B: remote transaction failed/cancelled/expired
      // Local invoice should be voided/expired through existing expiry cron
      // Return current state (no new gateway call)
      return {
        paymentUrl: invoice.paymentUrl,
        snapToken: invoice.snapToken,
        action: "terminal"
      };

    case "NOT_FOUND":
      // Window A: no gateway transaction exists
      // Safe to initialize fresh with deterministic order_id
      const initResultNotFound = await initializeMidtransSnap(tenant, {
        order_id: orderId,
        gross_amount: Math.round(invoice.grandTotal),
        customer_details: {
          first_name: invoice.customerName,
          phone: invoice.customerPhone,
          email: invoice.customerEmail || undefined,
        },
        item_details: invoice.itemDetails,
      });

      if (initResultNotFound.success) {
        return {
          paymentUrl: initResultNotFound.redirectUrl!,
          snapToken: initResultNotFound.token!,
          action: "initialized"
        };
      }

      // Initialization failed - leave durable, return retryable state
      return {
        paymentUrl: null,
        snapToken: null,
        action: "ambiguous"
      };

    case "UPSTREAM_AMBIGUOUS":
    default:
      // Window C: status lookup itself failed/ambiguous
      // Do NOT void invoice. Leave durable for retry.
      return {
        paymentUrl: invoice.paymentUrl,
        snapToken: invoice.snapToken,
        action: "ambiguous"
      };
  }
}