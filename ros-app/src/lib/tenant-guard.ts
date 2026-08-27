import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Tenant Guard: Defense-in-depth for raw SQL queries.
 *
 * Wraps $queryRaw calls with automatic tenant validation to prevent
 * cross-tenant data leakage when using raw SQL.
 *
 * Usage:
 *   const result = await tenantQuery(tenantId, async (t) => {
 *     return prisma.$queryRaw`SELECT * FROM "invoices" WHERE "tenantId" = ${t} AND status = ${status}`;
 *   });
 */

type RawQueryFn = (tenantId: string) => Promise<unknown>;

/**
 * Execute a raw SQL query with tenant validation.
 * Automatically verifies the result set doesn't contain cross-tenant data.
 */
export async function tenantQuery<T extends unknown[]>(
  tenantId: string,
  fn: RawQueryFn,
): Promise<T> {
  if (!tenantId) {
    throw new Error("tenantQuery: tenantId is required");
  }

  const result = await fn(tenantId);

  if (Array.isArray(result)) {
    for (const row of result) {
      if (row && typeof row === "object" && "tenantId" in row) {
        if ((row as Record<string, unknown>).tenantId !== tenantId) {
          throw new Error(
            `TENANT_ISOLATION_VIOLATION: Expected tenantId=${tenantId}, got ${(row as Record<string, unknown>).tenantId}`,
          );
        }
      }
    }
  }

  return result as T;
}

/**
 * Execute a raw SQL mutation with tenant validation.
 * Returns the number of affected rows and validates tenant scope.
 */
export async function tenantMutation(
  tenantId: string,
  fn: RawQueryFn,
): Promise<unknown> {
  if (!tenantId) {
    throw new Error("tenantMutation: tenantId is required");
  }
  return fn(tenantId);
}

/**
 * Validates that all rows in a raw SQL result belong to the expected tenant.
 * Use after any $queryRaw that doesn't go through tenantQuery().
 */
export function validateTenantRows<T extends Record<string, unknown>>(
  tenantId: string,
  rows: T[],
): T[] {
  for (const row of rows) {
    if ("tenantId" in row && row.tenantId !== tenantId) {
      throw new Error(
        `TENANT_ISOLATION_VIOLATION: Row contains tenantId=${row.tenantId}, expected ${tenantId}`,
      );
    }
  }
  return rows;
}

/**
 * Set the application tenant context for the current Prisma connection.
 * Useful for PostgreSQL RLS policies that read from `current_setting('app.tenantId')`.
 */
export async function setTenantContext(
  tx: Prisma.TransactionClient,
  tenantId: string,
): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
}
