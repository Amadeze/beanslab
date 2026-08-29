import { getCurrentTenantId, getSystemUserId } from "@/lib/auth";
import { prisma } from "./prisma";

export interface ServerActionRateLimitOptions {
  actionKey: string;
  maxRequests: number;
  windowSeconds: number;
}

export async function enforceServerActionRateLimit(
  options: ServerActionRateLimitOptions,
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const userId = await getSystemUserId();
  const tenantId = await getCurrentTenantId();
  const nowMs = Date.now();
  const windowMs = options.windowSeconds * 1000;
  const windowStartMs = Math.floor(nowMs / windowMs) * windowMs;
  const windowStart = new Date(windowStartMs);
  const expiresAt = new Date(windowStartMs + windowMs);

  const identifier = `${options.actionKey}:${tenantId}:${userId}`;
  const key = `server-action:${identifier}:${windowStartMs}`;

  const bucket = await prisma.rateLimitBucket.upsert({
    where: { key },
    create: { key, count: 1, windowStart, expiresAt },
    update: { count: { increment: 1 } },
    select: { count: true },
  });

  const allowed = bucket.count <= options.maxRequests;
  const remaining = Math.max(0, options.maxRequests - bucket.count);
  const resetAt = expiresAt;

  return { allowed, remaining, resetAt };
}

export async function enforceServerActionRateLimitOrThrow(
  options: ServerActionRateLimitOptions,
): Promise<void> {
  const result = await enforceServerActionRateLimit(options);
  if (!result.allowed) {
    const retryAfterSec = Math.max(1, Math.ceil((result.resetAt.getTime() - Date.now()) / 1000));
    throw new Error(
      `Rate limit exceeded for ${options.actionKey}. Try again in ${retryAfterSec} seconds.`,
    );
  }
}