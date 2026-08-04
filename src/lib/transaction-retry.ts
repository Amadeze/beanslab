import type { Prisma } from "@prisma/client";

// Structural so the helper works with both the base PrismaClient and the
// tenant-scoped extended client (withTenant). Their $transaction overloads
// differ slightly, so the callback parameter stays untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TransactionClient = any;

export type TransactionLike = {
  $transaction<T>(
    callback: (tx: TransactionClient) => Promise<T>,
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel },
  ): Promise<T>;
};

function isPrismaError(err: unknown, code: string): boolean {
  return (
    err != null &&
    typeof err === "object" &&
    "code" in err &&
    (err as { code?: unknown }).code === code
  );
}

/**
 * Runs a Serializable interactive transaction with bounded retry.
 *
 * Retries only on Prisma P2034 (deadlock / serialization failure). Any other
 * error is rethrown immediately. The callback is re-run as one unit, so a
 * failed attempt never commits partial writes (no duplicate rows).
 */
export async function withSerializableRetry<T>(
  client: TransactionLike,
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await client.$transaction(callback, { isolationLevel: "Serializable" });
    } catch (err) {
      if (isPrismaError(err, "P2034") && attempt < maxAttempts - 1) {
        attempt += 1;
        await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
        continue;
      }
      throw err;
    }
  }
}
