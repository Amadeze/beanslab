// Global platform RajaOngkir credential store (Superadmin-owned).
//
// Server-only. Secrets are encrypted at rest via src/lib/credentials.ts
// (AES-256-GCM) and masked when returned to the UI. The API key is NEVER
// returned in plaintext to clients, logs, or errors.

import { prisma } from "@/lib/prisma";
import {
  decryptCredential,
  encryptCredential,
  isEncryptedCredential,
} from "@/lib/credentials";
import { ShippingProviderError } from "./errors";
import type { RajaOngkirClientConfig } from "./providers/rajaongkir";

const PROVIDER = "RAJAONGKIR";

export type RajaOngkirConnectionStatus = "UNKNOWN" | "OK" | "FAILED";

export interface RajaOngkirIntegrationState {
  isConfigured: boolean;
  isActive: boolean;
  maskedKey?: string;
  lastTestedAt?: Date | null;
  connectionStatus?: RajaOngkirConnectionStatus | null;
  lastConnectionError?: string | null;
}

/** Masks an API key for display: shows first 4 and last 2 characters. */
export function maskApiKey(key: string): string {
  if (!key) return "";
  if (key.length <= 6) return "••••••";
  return `${key.slice(0, 4)}${"•".repeat(Math.max(4, key.length - 6))}${key.slice(-2)}`;
}

/** Redacts key-like tokens and truncates provider error text for safe storage. */
function sanitizeConnectionError(error?: string | null): string | null {
  if (!error) return null;
  const truncated = String(error).slice(0, 200);
  return truncated.replace(/[A-Za-z0-9_-]{24,}/g, "***");
}

export async function getRajaOngkirIntegrationState(): Promise<RajaOngkirIntegrationState> {
  const row = await prisma.platformIntegration.findUnique({
    where: { provider: PROVIDER },
  });

  const hasKey =
    !!row?.encryptedApiKey && isEncryptedCredential(row.encryptedApiKey);

  return {
    isConfigured: hasKey,
    isActive: hasKey && (row?.isActive ?? false),
    maskedKey: hasKey ? maskApiKey(decryptCredential(row!.encryptedApiKey)) : undefined,
    lastTestedAt: row?.lastTestedAt ?? null,
    connectionStatus: (row?.connectionStatus as RajaOngkirConnectionStatus | null) ?? null,
    lastConnectionError: row?.lastConnectionError ?? null,
  };
}

/**
 * Resolves a decrypted client config for provider calls. Throws a controlled
 * domain error (never the key) when the integration is disabled or the key is
 * missing. Server-only.
 */
export async function getRajaOngkirClientConfig(): Promise<RajaOngkirClientConfig> {
  const row = await prisma.platformIntegration.findUnique({
    where: { provider: PROVIDER },
  });

  if (!row || !row.isActive || !row.encryptedApiKey || !isEncryptedCredential(row.encryptedApiKey)) {
    throw new ShippingProviderError(
      "INTEGRATION_DISABLED",
      "RajaOngkir integration is not active.",
    );
  }

  const apiKey = decryptCredential(row.encryptedApiKey);
  if (!apiKey) {
    throw new ShippingProviderError(
      "MISSING_CREDENTIAL",
      "RajaOngkir API key is missing.",
    );
  }

  return {
    apiKey,
  };
}

/** Encrypts and persists the platform API key. Marks the integration active. */
export async function upsertRajaOngkirApiKey(apiKey: string): Promise<void> {
  const encrypted = encryptCredential(apiKey);
  await prisma.platformIntegration.upsert({
    where: { provider: PROVIDER },
    create: {
      provider: PROVIDER,
      encryptedApiKey: encrypted,
      isActive: true,
    },
    update: {
      encryptedApiKey: encrypted,
      isActive: true,
    },
  });
}

/** Persists the result of a Superadmin connection test (sanitized only). */
export async function recordRajaOngkirConnectionResult(
  status: RajaOngkirConnectionStatus,
  error?: string | null,
): Promise<void> {
  await prisma.platformIntegration.upsert({
    where: { provider: PROVIDER },
    create: {
      provider: PROVIDER,
      isActive: true,
      lastTestedAt: new Date(),
      connectionStatus: status,
      lastConnectionError: sanitizeConnectionError(error),
    },
    update: {
      lastTestedAt: new Date(),
      connectionStatus: status,
      lastConnectionError: sanitizeConnectionError(error),
    },
  });
}
