// =============================================================================
// LEGACY STOCK IMPORTER — RESOLVER (DRY-RUN)
// =============================================================================
// Tenant-scoped, read-only resolution of validated rows to CREATE/MATCH/ERROR.
// No DB writes. Pure async logic.

import type {
  LegacyStockValidatedRow,
  LegacyStockDryRunRow,
  LegacyStockDryRunResult,
  LegacyStockDryRunSummary,
  ResolverContext,
  DryRunAction,
} from "./types";

// ─── Helpers ───
function buildSummary(rows: LegacyStockDryRunRow[]): LegacyStockDryRunSummary {
  const validRows = rows.filter((r) => r.isValid).length;
  const createCount = rows.filter((r) => r.action === "CREATE").length;
  const matchCount = rows.filter((r) => r.action === "MATCH").length;
  const errorCount = rows.filter((r) => r.action === "ERROR").length;
  return { totalRows: rows.length, validRows, createCount, matchCount, errorCount };
}

// ─── Main Resolver ───
export async function resolveLegacyStockDryRun(
  validatedRows: LegacyStockValidatedRow[],
  ctx: ResolverContext
): Promise<LegacyStockDryRunResult> {
  const results: LegacyStockDryRunRow[] = [];

  for (const row of validatedRows) {
    // Start with ERROR for invalid rows
    if (!row.isValid) {
      results.push({
        ...row,
        action: "ERROR",
      });
      continue;
    }

    const type = row.type;
    const code = row.code;

    try {
      if (type === "GREEN_BEAN" || type === "ROASTED_BEAN" || type === "FINISHED_GOODS") {
        const product = await ctx.findProductByCode(code);
        if (product) {
          // Check type compatibility
          const expectedType = type === "FINISHED_GOODS" ? "FINISHED_GOODS" :
                               type === "ROASTED_BEAN" ? "ROASTED_BEAN" : "GREEN_BEAN";
          if (product.type !== expectedType) {
            results.push({
              ...row,
              action: "ERROR",
              errors: [
                ...row.errors,
                { field: "type", message: `Existing product code "${code}" is ${product.type}, not ${expectedType}.` },
              ],
            });
          } else {
            results.push({
              ...row,
              action: "MATCH",
              matchedEntityId: product.id,
              matchedEntityType: "PRODUCT",
              matchedEntityCode: product.code,
            });
          }
        } else {
          results.push({
            ...row,
            action: "CREATE",
          });
        }
      } else if (type === "SUPPLY") {
        const supply = await ctx.findSupplyItemByCode(code);
        if (supply) {
          // Check category compatibility
          if (row.category && supply.category !== row.category) {
            results.push({
              ...row,
              action: "ERROR",
              errors: [
                ...row.errors,
                { field: "category", message: `Existing supply code "${code}" is ${supply.category}, not ${row.category}.` },
              ],
            });
          } else {
            results.push({
              ...row,
              action: "MATCH",
              matchedEntityId: supply.id,
              matchedEntityType: "SUPPLY",
              matchedEntityCode: supply.code,
            });
          }
        } else {
          results.push({
            ...row,
            action: "CREATE",
          });
        }
      } else {
        results.push({
          ...row,
          action: "ERROR",
          errors: [
            ...row.errors,
            { field: "type", message: `Unsupported type: ${type}` },
          ],
        });
      }
    } catch (err) {
      results.push({
        ...row,
        action: "ERROR",
        errors: [
          ...row.errors,
          { field: "_resolver", message: `Resolver error: ${err instanceof Error ? err.message : "Unknown error"}` },
        ],
      });
    }
  }

  return {
    summary: buildSummary(results),
    rows: results,
  };
}