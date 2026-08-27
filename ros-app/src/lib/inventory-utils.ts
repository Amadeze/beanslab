/**
 * Shared inventory predicates and display helpers.
 *
 * RULE: All status, value, and metric calculations in the inventory module
 * MUST use these functions. Do not duplicate logic in components.
 */
import type { ReorderSummary } from "./reorder";
import type { ProductStockRow, PackagingStockRow, FGStockRow } from "@/app/(dashboard)/inventory/types";
import { formatRupiah } from "./format";

// =============================================================================
// STATUS DISPLAY
// =============================================================================

export type DisplayStatus = "aman" | "rendah" | "habis" | "belum_dikonfigurasi";

/**
 * Single source of truth for the status badge shown in tables and cards.
 *
 * Two dimensions are separated:
 * 1. Configuration state — has the operator ever saved reorder settings?
 *    Derived from reorderSummary existence + reorderAlertEnabled.
 * 2. Calculated reorder status — what is the stock condition?
 *    Derived from stock level vs reorder point (with legacy fallback).
 */
export function getDisplayStatus(
  currentStock: number,
  type: string,
  reorderSummary?: ReorderSummary,
): DisplayStatus {
  // If stock is zero, it's always "habis" regardless of config
  if (currentStock <= 0) return "habis";

  // If no reorder summary exists, this SKU was never configured — use legacy fallback
  if (!reorderSummary) {
    return getLegacyStatus(currentStock, type);
  }

  // If reorder alert is not enabled, the operator hasn't configured this SKU
  // BUT we still compute a calculated status via legacy fallback
  if (reorderSummary.status === "belum_dikonfigurasi") {
    // Show "Belum Diatur" only if truly not configured (alert not enabled)
    // If configured but data insufficient, show calculated status
    if (!reorderSummary.hasEnoughData) {
      return getLegacyStatus(currentStock, type);
    }
    return "belum_dikonfigurasi";
  }

  // Calculated status from reorder system
  if (reorderSummary.status === "perlu_pesan") return "rendah";
  if (reorderSummary.status === "habis") return "habis";
  return "aman";
}

function getLegacyStatus(currentStock: number, type: string): DisplayStatus {
  if (currentStock <= 0) return "habis";
  if (type === "PACKAGING") {
    return currentStock < 50 ? "rendah" : "aman";
  }
  const threshold = type === "GREEN_BEAN" ? 10 : 5;
  return currentStock < threshold ? "rendah" : "aman";
}

// =============================================================================
// CONFIGURATION STATE
// =============================================================================

/**
 * Whether a SKU has ever had reorder configuration saved.
 * This is a configuration state, NOT a calculated status.
 */
export function isReorderConfigured(summary?: ReorderSummary): boolean {
  if (!summary) return false;
  // The summary exists means the SKU has reorder fields in DB.
  // "belum_dikonfigurasi" status means alertEnabled = false.
  return summary.status !== "belum_dikonfigurasi";
}

// =============================================================================
// PREDICATES (shared between cards and list)
// =============================================================================

/** Is this SKU out of stock? Used by summary card and table filter. */
export function isHabis(currentStock: number, reorderSummary?: ReorderSummary): boolean {
  if (currentStock <= 0) return true;
  return reorderSummary?.status === "habis";
}

/** Does this SKU need to be ordered? Used by summary card and table filter. */
export function isNeedsOrder(currentStock: number, reorderSummary?: ReorderSummary): boolean {
  if (currentStock <= 0) return false;
  return reorderSummary?.status === "perlu_pesan";
}

// =============================================================================
// INVENTORY VALUE
// =============================================================================

/**
 * Calculate inventory value for a single SKU.
 * Returns null when HPP is unavailable (not when stock is 0).
 *
 * RULE: value = currentStock × HPP
 * - stock=0, HPP available → 0
 * - stock>0, HPP available → calculated value
 * - HPP unavailable → null (display "—")
 */
export function calcInventoryValue(
  currentStock: number,
  hpp: number | null | undefined,
): number | null {
  if (hpp == null) return null;
  return hpp * currentStock;
}

/**
 * Format inventory value for display.
 * Returns formatted string or "—" with hint when HPP is unavailable.
 */
export function formatInventoryValue(
  currentStock: number,
  hpp: number | null | undefined,
): { text: string; unavailable: boolean } {
  if (hpp == null) {
    return { text: "—", unavailable: true };
  }
  return { text: formatRupiah(hpp * currentStock), unavailable: false };
}

/**
 * Calculate total inventory value across all stock types.
 * Uses the same formula as individual SKU value calculation.
 */
export function calcTotalInventoryValue(
  gbStocks: ProductStockRow[],
  rbStocks: ProductStockRow[],
  fgStocks: FGStockRow[],
  pkgStocks: PackagingStockRow[],
): number {
  let total = 0;
  for (const p of [...gbStocks, ...rbStocks]) {
    if (p.latestHppPerKg != null) {
      total += p.latestHppPerKg * Number(p.stockKg);
    }
  }
  for (const fg of fgStocks) {
    if (fg.latestHppPerUnit != null) {
      total += fg.latestHppPerUnit * Number(fg.stockUnit);
    }
  }
  for (const pkg of pkgStocks) {
    total += pkg.costPerUnit * Number(pkg.stockUnit);
  }
  return total;
}

// =============================================================================
// METRICS (shared between summary strip and per-tab counts)
// =============================================================================

export interface InventoryMetrics {
  totalSku: number;
  totalValue: number;
  outOfStockCount: number;
  needsOrderCount: number;
  configuredCount: number;
  notConfiguredCount: number;
}

/**
 * Calculate inventory metrics from stock data and reorder summaries.
 * This is the SINGLE source of truth for all summary cards/strip.
 *
 * Uses the same predicates as the table rows — no duplicate logic.
 */
export function calcInventoryMetrics(
  gbStocks: ProductStockRow[],
  rbStocks: ProductStockRow[],
  fgStocks: FGStockRow[],
  pkgStocks: PackagingStockRow[],
  productReorderSummaries?: ReorderSummary[],
  packagingReorderSummaries?: ReorderSummary[],
  supplyReorderSummaries?: ReorderSummary[],
): InventoryMetrics {
  const allProducts = [...gbStocks, ...rbStocks];
  const totalSku = allProducts.length + fgStocks.length + pkgStocks.length;

  const totalValue = calcTotalInventoryValue(gbStocks, rbStocks, fgStocks, pkgStocks);

  // Build reorder lookup maps
  const productMap = new Map<string, ReorderSummary>();
  for (const s of productReorderSummaries ?? []) productMap.set(s.skuId, s);
  const pkgMap = new Map<string, ReorderSummary>();
  for (const s of packagingReorderSummaries ?? []) pkgMap.set(s.skuId, s);

  let outOfStockCount = 0;
  let needsOrderCount = 0;
  let configuredCount = 0;
  let notConfiguredCount = 0;

  // Check all products
  for (const p of allProducts) {
    const summary = productMap.get(p.id);
    const stock = Number(p.stockKg);
    if (isHabis(stock, summary)) outOfStockCount++;
    if (isNeedsOrder(stock, summary)) needsOrderCount++;
    if (isReorderConfigured(summary)) configuredCount++;
    else notConfiguredCount++;
  }

  // Check finished goods
  for (const fg of fgStocks) {
    const summary = productMap.get(fg.id);
    const stock = Number(fg.stockUnit);
    if (isHabis(stock, summary)) outOfStockCount++;
    if (isNeedsOrder(stock, summary)) needsOrderCount++;
    if (isReorderConfigured(summary)) configuredCount++;
    else notConfiguredCount++;
  }

  // Check packaging
  for (const pkg of pkgStocks) {
    const summary = pkgMap.get(pkg.id);
    const stock = Number(pkg.stockUnit);
    if (isHabis(stock, summary)) outOfStockCount++;
    if (isNeedsOrder(stock, summary)) needsOrderCount++;
    if (isReorderConfigured(summary)) configuredCount++;
    else notConfiguredCount++;
  }

  // Check supply items (canonical non-coffee SKUs; dual-read safe because
  // linked packagings are excluded from packagingReorderSummaries)
  for (const summary of supplyReorderSummaries ?? []) {
    const stock = summary.currentStock;
    if (isHabis(stock, summary)) outOfStockCount++;
    if (isNeedsOrder(stock, summary)) needsOrderCount++;
  }

  return {
    totalSku,
    totalValue,
    outOfStockCount,
    needsOrderCount,
    configuredCount,
    notConfiguredCount,
  };
}
