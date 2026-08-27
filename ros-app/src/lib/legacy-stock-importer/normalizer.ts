// =============================================================================
// LEGACY STOCK IMPORTER — NORMALIZER
// =============================================================================
// Pure transformation: raw rows → normalized rows with proper types.
// No validation, no DB access. Easy to unit test.

import type { LegacyStockRawRow, LegacyStockNormalizedRow, LegacyStockType, InventorySupplyCategory, SupplyBaseUnit, RoastLevel } from "./types";

// ─── Helpers ───
function trim(s: unknown): string {
  return String(s ?? "").trim();
}

function toUpper(s: unknown): string {
  return trim(s).toUpperCase();
}

function parseNumber(v: unknown): number | null {
  const s = trim(v);
  if (!s) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseDate(v: unknown): Date | null {
  const s = trim(v);
  if (!s) return null;
  // Try ISO first, then common formats
  const iso = new Date(s);
  if (!Number.isNaN(iso.getTime())) return iso;
  // Try DD/MM/YYYY or DD-MM-YYYY
  const parts = s.split(/[\/\-]/);
  if (parts.length === 3) {
    const d = Number(parts[0]);
    const m = Number(parts[1]);
    const y = Number(parts[2]);
    if (y > 1000 && y < 3000 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const dt = new Date(y, m - 1, d);
      if (!Number.isNaN(dt.getTime())) return dt;
    }
  }
  return null;
}

function normalizeStockType(v: unknown): LegacyStockType | null {
  const t = toUpper(v);
  if (["GREEN_BEAN", "ROASTED_BEAN", "FINISHED_GOODS", "SUPPLY"].includes(t)) {
    return t as LegacyStockType;
  }
  return null;
}

function normalizeSupplyCategory(v: unknown): InventorySupplyCategory | null {
  const t = toUpper(v);
  if (["PACKAGING", "INGREDIENT", "CONSUMABLE", "MERCHANDISE", "SPARE_PART", "EQUIPMENT", "OTHER"].includes(t)) {
    return t as InventorySupplyCategory;
  }
  return null;
}

function normalizeSupplyBaseUnit(v: unknown): SupplyBaseUnit | null {
  const t = toUpper(v);
  if (["KG", "GRAM", "LITER", "METER", "ROLL", "PCS", "BOX", "SET", "OTHER"].includes(t)) {
    return t as SupplyBaseUnit;
  }
  return null;
}

function normalizeRoastLevel(v: unknown): RoastLevel | null {
  const t = toUpper(v);
  if (["LIGHT", "MEDIUM", "MEDIUM_DARK", "DARK"].includes(t)) {
    return t as RoastLevel;
  }
  return null;
}

// ─── Normalizer ───
export function normalizeLegacyStockRows(
  rawRows: LegacyStockRawRow[]
): LegacyStockNormalizedRow[] {
  return rawRows.map((raw, idx) => {
    const rowNumber = idx + 2; // 1-based, header = row 1
    const normalized: LegacyStockNormalizedRow = {
      type: normalizeStockType(raw.type) ?? "SUPPLY", // default, will be validated later
      code: trim(raw.code).toUpperCase(),
      name: trim(raw.name),
      quantity: parseNumber(raw.quantity) ?? 0,
      unitCost: parseNumber(raw.unitCost) ?? 0,
      rowNumber,
    };

    // Optional fields
    if (raw.category) normalized.category = normalizeSupplyCategory(raw.category) ?? undefined;
    if (raw.baseUnit) normalized.baseUnit = normalizeSupplyBaseUnit(raw.baseUnit) ?? undefined;
    if (raw.origin) normalized.origin = trim(raw.origin) || undefined;
    if (raw.roastLevel) normalized.roastLevel = normalizeRoastLevel(raw.roastLevel) ?? undefined;
    if (raw.netWeightGrams) normalized.netWeightGrams = parseNumber(raw.netWeightGrams) ?? undefined;
    if (raw.capacityGrams) normalized.capacityGrams = parseNumber(raw.capacityGrams) ?? undefined;
    if (raw.tareWeightGrams) normalized.tareWeightGrams = parseNumber(raw.tareWeightGrams) ?? undefined;
    if (raw.lotNumber) normalized.lotNumber = trim(raw.lotNumber) || undefined;
    if (raw.receivedAt) normalized.receivedAt = parseDate(raw.receivedAt) ?? undefined;
    if (raw.expiryDate) normalized.expiryDate = parseDate(raw.expiryDate) ?? undefined;
    if (raw.supplierCode) normalized.supplierCode = trim(raw.supplierCode).toUpperCase() || undefined;
    if (raw.notes) normalized.notes = trim(raw.notes) || undefined;

    return normalized;
  });
}