// Shipping quote token for Batch 3.
// Tamper-evident, time-limited token containing the authoritative shipping
// quote. Uses the same AES-256-GCM infrastructure as the origin token.

import crypto from "crypto";

const PREFIX = "sqtv1"; // Shipping Quote Token v1
const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes

function runtimeEncryptionSecret(): string {
  const secret = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!secret) throw new Error("CREDENTIAL_ENCRYPTION_KEY is required for quote tokens.");
  return secret;
}

function encryptionKey(secret: string): Buffer {
  return crypto.createHash("sha256").update(secret).digest();
}

export interface ShippingQuotePayload {
  version: 1;
  tenantId: string;
  destination: {
    providerId: string;
    label: string;
    province?: string;
    city?: string;
    district?: string;
    subdistrict?: string;
    postalCode?: string;
  };
  origin: {
    providerId: string;
    label: string;
    province?: string;
    city?: string;
    district?: string;
    subdistrict?: string;
    postalCode?: string;
  };
  courierCode: string;
  courierName: string;
  serviceCode: string;
  serviceName?: string;
  cost: number; // integer Rupiah
  etd?: string;
  shipmentWeightGrams: number; // integer grams
  cartFingerprint: string;
  tareGrams: number; // tenant tare used for the quote
  issuedAt: number; // epoch ms
  expiresAt: number; // epoch ms
}

/**
 * Creates a shipping quote token from the authoritative quote data.
 * Uses a 15-minute TTL by default.
 */
export function createShippingQuoteToken(
  payload: Omit<ShippingQuotePayload, "issuedAt" | "expiresAt">,
  ttlMs = DEFAULT_TTL_MS,
): string {
  const now = Date.now();
  const payloadWithTime: ShippingQuotePayload = {
    ...payload,
    issuedAt: now,
    expiresAt: now + ttlMs,
  };

  const secret = runtimeEncryptionSecret();
  const key = encryptionKey(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = JSON.stringify(payloadWithTime);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

/**
 * Verifies a shipping quote token and returns the payload when valid,
 * or null when the token is malformed, tampered, or expired.
 */
export function verifyShippingQuoteToken(token: string): ShippingQuotePayload | null {
  if (!token.startsWith(`${PREFIX}:`)) return null;

  const secret = runtimeEncryptionSecret();
  const key = encryptionKey(secret);
  const parts = token.split(":");
  if (parts.length !== 4) return null;

  const [, ivB64, tagB64, encryptedB64] = parts;
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedB64, "base64url")),
      decipher.final(),
    ]).toString("utf8");

    const payload = JSON.parse(decrypted) as ShippingQuotePayload;

    if (payload.version !== 1) return null;
    if (!payload.tenantId || !payload.courierCode || !payload.serviceCode) return null;
    if (!Number.isInteger(payload.cost) || payload.cost <= 0) return null;
    if (!Number.isFinite(payload.shipmentWeightGrams) || payload.shipmentWeightGrams <= 0) return null;
    if (typeof payload.cartFingerprint !== "string" || payload.cartFingerprint.length === 0) return null;

    // TTL check.
    if (Date.now() >= payload.expiresAt) return null;

    return payload;
  } catch {
    return null;
  }
}