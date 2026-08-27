import { createHash } from "node:crypto";

// ─── Trusted client identity ────────────────────────────────────────────────
//
// Forwarded headers (X-Forwarded-For, X-Real-IP) are client-controlled when
// the request reaches the application directly, so they are NEVER trusted
// implicitly. The application runs on Vercel (the platform sets `VERCEL` and
// injects its own proxy headers at the edge) and can also be self-hosted.
//
// Trust is granted only when the runtime is provably behind a proxy that owns
// the source connection:
//
// 1. VERCEL (process.env.VERCEL === "1") — set by the platform, cannot be
//    forged by clients. ONLY the `x-vercel-forwarded-for` header written by
//    the edge proxy is trusted; `x-forwarded-for` / `x-real-ip` are ignored.
//    If the header is missing or malformed the network identity is null.
// 2. Self-hosted with an EXPLICIT trusted-reverse-proxy config:
//    - TRUST_PROXY=1 (or "true") and TRUSTED_PROXY_HOPS=<n> (default 1).
//    Required deployment conditions (must hold or the config must not be set):
//      * the application port is not reachable from the internet;
//      * the proxy strips any forwarded headers coming from clients;
//      * the proxy writes forwarded headers from the source connection;
//      * the number of trusted hops is known and fixed.
//    The forwarded chain is all-or-nothing: a single malformed entry makes
//    the whole chain invalid (no per-entry filtering before hop counting).
//    Without this config, forwarded headers are ignored entirely.
//
// When no network identity is trustworthy the caller must NOT invent one
// (no random per-request identifiers, no global "unknown"/"untrusted"
// bucket); the network layer is simply skipped and the bucket is built from
// account/tenant/resource identifiers instead.

export type ClientIdentityProvider = "vercel" | "trusted-proxy" | "untrusted";

export type ClientIdentity = {
  /** The trusted client IP, or null when no network identity is trustworthy. */
  ip: string | null;
  /** Whether `ip` can be trusted as the client's network identity. */
  trusted: boolean;
  provider: ClientIdentityProvider;
};

type HeaderLike = { get(name: string): string | null | undefined };

export const UNTRUSTED_IDENTITY: ClientIdentity = {
  ip: null,
  trusted: false,
  provider: "untrusted",
};

const IPV4_PART = "(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const IPV4_RE = new RegExp(`^${IPV4_PART}\\.${IPV4_PART}\\.${IPV4_PART}\\.${IPV4_PART}$`);
const IPV6_RE = /^[0-9a-fA-F:.]+$/;

export function isPlausibleIp(value: string): boolean {
  if (!value || value.length > 45 || value === "unknown" || value === "untrusted") {
    return false;
  }
  if (value.includes(":")) {
    return IPV6_RE.test(value) && value !== ":";
  }
  return IPV4_RE.test(value);
}

/**
 * Splits an X-Forwarded-For style chain (leftmost = client, rightmost = last
 * proxy). All-or-nothing: if ANY entry is malformed the whole chain is treated
 * as invalid ([]) — a broken entry is never dropped so a client-supplied value
 * can sneak into a trusted hop position.
 */
export function parseForwardedChain(value: string | null | undefined): string[] {
  if (!value) return [];
  const entries = value.split(",").map((entry) => entry.trim());
  if (entries.length === 0 || entries.some((entry) => !isPlausibleIp(entry))) {
    return [];
  }
  return entries;
}

function trustedProxyHops(): number | null {
  const flag = process.env.TRUST_PROXY;
  if (flag !== "1" && flag !== "true") return null;
  const hops = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "1", 10);
  return Number.isFinite(hops) && hops > 0 ? hops : 1;
}

export function resolveClientIdentity(headers: HeaderLike): ClientIdentity {
  if (process.env.VERCEL === "1") {
    // Only Vercel's own chain header is trusted (it is written by the edge
    // proxy from the source connection). X-Forwarded-For / X-Real-IP are
    // ignored even when present; if the Vercel header is missing or invalid
    // the network identity is null.
    const chain = parseForwardedChain(headers.get("x-vercel-forwarded-for"));
    const ip = chain[0] ?? null;
    return ip
      ? { ip, trusted: true, provider: "vercel" }
      : { ip: null, trusted: false, provider: "vercel" };
  }

  const hops = trustedProxyHops();
  if (hops !== null) {
    const chain = parseForwardedChain(headers.get("x-forwarded-for"));
    if (chain.length > 0) {
      const idx = chain.length - hops;
      if (idx >= 0) return { ip: chain[idx], trusted: true, provider: "trusted-proxy" };
    }
    const realIp = headers.get("x-real-ip")?.trim() ?? null;
    if (realIp && isPlausibleIp(realIp)) {
      return { ip: realIp, trusted: true, provider: "trusted-proxy" };
    }
    return { ip: null, trusted: false, provider: "trusted-proxy" };
  }

  return UNTRUSTED_IDENTITY;
}

// ─── Normalization ──────────────────────────────────────────────────────────
// Deterministic, idempotent, and PII-safe: raw values are normalized and then
// hashed before they ever reach a rate-limit key or log.

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

// ─── Layered bucket identifiers ─────────────────────────────────────────────
// Every identifier is namespaced and hashed by enforceRateLimit; token-like
// values are pre-hashed so only digests reach the bucket key. Returned strings
// contain NO raw PII, tokens, subdomains, or credentials.

/** Network layer — null when the IP cannot be trusted (skip the layer). */
export function networkIdentifier(identity: ClientIdentity): string | null {
  return identity.trusted && identity.ip ? `net:${identity.ip}` : null;
}

/** Account layer for a normalized email. */
export function emailIdentifier(email: string): string {
  return `email:${normalizeEmail(email)}`;
}

/** Account layer for a normalized phone number (digits only). */
export function phoneIdentifier(phone: string): string {
  return `phone:${normalizePhone(phone)}`;
}

/** Pre-hashed resource layer (raw secret-like values never enter the key). */
export function digestIdentifier(kind: string, value: string): string {
  return `${kind}:${sha256(value)}`;
}

/** Account layer for a tenant id. */
export function tenantIdentifier(tenantId: string): string {
  return `tenant:${tenantId}`;
}

/** Account layer for a user id. */
export function userIdentifier(userId: string): string {
  return `user:${userId}`;
}

/** Account layer for an authenticated connector. */
export function connectorIdentifier(connectorId: string): string {
  return `connector:${connectorId}`;
}

/**
 * Combines the network layer (when the identity is trusted) with the
 * endpoint-specific layers. Returns an empty array only when the identity is
 * untrusted and the endpoint has no other identity — callers must then apply
 * their own resource/account layers (never a synthetic "unknown" bucket).
 */
export function layeredIdentifiers(
  identity: ClientIdentity,
  layers: string[],
): string[] {
  const network = networkIdentifier(identity);
  return network ? [network, ...layers] : layers;
}
