import crypto from "crypto";

import { prisma } from "./prisma";

export class RateLimitError extends Error {
  retryAfter: number;

  constructor(retryAfter: number) {
    super("Terlalu banyak permintaan. Silakan coba lagi nanti.");
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

/**
 * Thrown when a rate-limited endpoint resolves to no bucket identifiers at
 * all (e.g. a public endpoint on a deployment without a trusted network
 * identity). Fail closed: the request is rejected with a controlled
 * configuration error instead of silently bypassing the rate limit.
 */
export class RateLimitMisconfigurationError extends Error {
  constructor(scope: string) {
    super(
      `[rate-limit] Misconfiguration: scope "${scope}" resolved to zero identifiers. ` +
        "Every endpoint needs at least one non-network layer (account/tenant/resource). " +
        "For public endpoints that rely on a network layer, run on Vercel or configure a trusted reverse proxy (TRUST_PROXY + TRUSTED_PROXY_HOPS).",
    );
    this.name = "RateLimitMisconfigurationError";
  }
}

type RateLimitInput = {
  scope: string;
  /**
   * One or more layered bucket identifiers (e.g. network + account + tenant).
   * Each identifier is enforced independently in the same window; a request
   * is rejected when ANY layer is over its limit. Use the builders from
   * `./client-identity` — never pass raw PII, tokens, or client-supplied IPs
   * without a trusted identity.
   */
  identifiers: string[];
  limit: number;
  windowSeconds: number;
};

export async function enforceRateLimit({
  scope,
  identifiers,
  limit,
  windowSeconds,
}: RateLimitInput) {
  const nowMs = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowStartMs = Math.floor(nowMs / windowMs) * windowMs;
  const windowStart = new Date(windowStartMs);
  const expiresAt = new Date(windowStartMs + windowMs);
  let remaining = limit;

  if (identifiers.length === 0) {
    throw new RateLimitMisconfigurationError(scope);
  }

  for (const identifier of identifiers) {
    const identifierHash = crypto
      .createHash("sha256")
      .update(identifier)
      .digest("hex");
    const key = `${scope}:${identifierHash}:${windowStartMs}`;

    const bucket = await prisma.rateLimitBucket.upsert({
      where: { key },
      create: { key, count: 1, windowStart, expiresAt },
      update: { count: { increment: 1 } },
      select: { count: true },
    });

    if (bucket.count > limit) {
      throw new RateLimitError(
        Math.max(1, Math.ceil((expiresAt.getTime() - nowMs) / 1000)),
      );
    }
    remaining = Math.min(remaining, Math.max(0, limit - bucket.count));
  }

  return { remaining, resetAt: expiresAt };
}