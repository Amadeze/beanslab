// Deterministic cart fingerprint for shipping quote binding.
// Server-only. Ensures a quote cannot travel across a materially changed
// cart state (identity, quantity, net weight, unit price, tare, origin,
// destination, tenant).

import crypto from "crypto";

export interface FingerprintLine {
  // For offering lines the canonical identity is offeringVariantId only;
  // productId is ignored/normalized away so quote-time and checkout-time
  // fingerprints match regardless of the productId each side passes.
  productId: string;
  offeringVariantId?: string | null;
  quantity: number;
  netWeightGrams: number;
  unitPrice: number;
}

export interface CartFingerprintInput {
  tenantId: string;
  originProviderId: string;
  destinationProviderId: string;
  tareGrams: number;
  lines: FingerprintLine[];
}

function normalizeLine(line: FingerprintLine) {
  if (line.offeringVariantId) {
    return {
      variantId: line.offeringVariantId,
      quantity: line.quantity,
      netWeightGrams: line.netWeightGrams,
      unitPrice: line.unitPrice,
    };
  }
  return {
    productId: line.productId,
    quantity: line.quantity,
    netWeightGrams: line.netWeightGrams,
    unitPrice: line.unitPrice,
  };
}

function lineSortKey(line: FingerprintLine): string {
  return line.offeringVariantId
    ? `variant:${line.offeringVariantId}`
    : `product:${line.productId}`;
}

function deterministicStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(deterministicStringify).join(",")}]`;
  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
  return `{${sortedKeys.map((k) => `${JSON.stringify(k)}:${deterministicStringify((obj as Record<string, unknown>)[k])}`).join(",")}}`;
}

/**
 * Creates a deterministic cart fingerprint binding the exact cart state at
 * quote time. Deterministic ordering + SHA-256; returns the first 32 hex
 * characters (128 bits) for compact storage.
 */
export function createCartFingerprint(input: CartFingerprintInput): string {
  const normalizedLines = [...input.lines]
    .sort((a, b) => lineSortKey(a).localeCompare(lineSortKey(b)))
    .map(normalizeLine);

  const payload = {
    v: 1,
    tenantId: input.tenantId,
    originProviderId: input.originProviderId,
    destinationProviderId: input.destinationProviderId,
    tareGrams: input.tareGrams,
    lines: normalizedLines,
  };

  // Deterministic JSON serialization with recursively sorted keys.
  const json = deterministicStringify(payload);

  const hash = crypto.createHash("sha256").update(json).digest("hex");
  return hash.substring(0, 32);
}

/**
 * Verifies that a stored fingerprint matches the current cart state.
 */
export function verifyCartFingerprint(
  storedFingerprint: string,
  currentInput: CartFingerprintInput,
): boolean {
  return storedFingerprint === createCartFingerprint(currentInput);
}