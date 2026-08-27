// Server selection token for RajaOngkir origin validation.
// The origin-search route returns a tamper-evident token containing the
// provider-normalized destination snapshot. The save action verifies the token
// and persists only the authenticated server payload.

import crypto from "crypto";
import { decryptCredential, encryptCredential } from "@/lib/credentials";
import type { RajaOngkirDestination } from "./types";

const PREFIX = "ostv1"; // Origin Selection Token v1

function runtimeEncryptionSecret(): string {
  const secret = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!secret) throw new Error("CREDENTIAL_ENCRYPTION_KEY is required for origin tokens.");
  return secret;
}

function encryptionKey(secret: string): Buffer {
  return crypto.createHash("sha256").update(secret).digest();
}

export interface OriginSelectionPayload {
  providerId: string;
  label: string;
  province?: string;
  city?: string;
  district?: string;
  subdistrict?: string;
  postalCode?: string;
  // Optional tenant binding. Public storefront destination tokens MUST carry
  // the resolved tenant id so a token minted for tenant A is rejected by
  // tenant B. Admin origin-search tokens (session-scoped) may omit it.
  tenantId?: string;
  issuedAt: number; // epoch ms
}

export function createOriginSelectionToken(payload: OriginSelectionPayload): string {
  const secret = runtimeEncryptionSecret();
  const key = encryptionKey(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

export function verifyOriginSelectionToken(token: string): OriginSelectionPayload | null {
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
    const payload = JSON.parse(decrypted) as OriginSelectionPayload;
    // Optional TTL check (24 hours)
    if (Date.now() - payload.issuedAt > 24 * 60 * 60 * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Convert a provider destination to a token payload. */
export function destinationToPayload(dest: {
  providerId: string;
  label: string;
  province?: string;
  city?: string;
  district?: string;
  subdistrict?: string;
  postalCode?: string;
}): OriginSelectionPayload {
  return {
    providerId: dest.providerId,
    label: dest.label,
    province: dest.province,
    city: dest.city,
    district: dest.district,
    subdistrict: dest.subdistrict,
    postalCode: dest.postalCode,
    issuedAt: Date.now(),
  };
}