// =============================================================================
// LEGACY STOCK IMPORTER — TYPES & CONTRACTS
// =============================================================================
// Single canonical tabular format for legacy stock import (dry-run only).
// No DB writes. Parser/normalizer/validator are pure functions.
// Resolver is tenant-scoped and read-only.

import type { InventorySupplyCategory, SupplyBaseUnit, ProductType, RoastLevel } from "@prisma/client";
export type { InventorySupplyCategory, SupplyBaseUnit, ProductType, RoastLevel };

// ─── Supported Stock Types ───
export type LegacyStockType = "GREEN_BEAN" | "ROASTED_BEAN" | "FINISHED_GOODS" | "SUPPLY";

export const SUPPORTED_STOCK_TYPES: LegacyStockType[] = [
  "GREEN_BEAN",
  "ROASTED_BEAN",
  "FINISHED_GOODS",
  "SUPPLY",
];

export const SUPPLY_CATEGORIES: InventorySupplyCategory[] = [
  "PACKAGING",
  "INGREDIENT",
  "CONSUMABLE",
  "MERCHANDISE",
  "SPARE_PART",
  "EQUIPMENT",
  "OTHER",
];

export const SUPPLY_BASE_UNITS: SupplyBaseUnit[] = [
  "KG",
  "GRAM",
  "LITER",
  "METER",
  "ROLL",
  "PCS",
  "BOX",
  "SET",
  "OTHER",
];

export const ROAST_LEVELS: RoastLevel[] = [
  "LIGHT",
  "MEDIUM",
  "MEDIUM_DARK",
  "DARK",
];

// ─── Raw Row (as parsed from file) ───
export interface LegacyStockRawRow {
  type: string;
  code: string;
  name: string;
  quantity: string | number;
  unitCost: string | number;
  category?: string;
  baseUnit?: string;
  origin?: string;
  roastLevel?: string;
  netWeightGrams?: string | number;
  capacityGrams?: string | number;
  tareWeightGrams?: string | number;
  lotNumber?: string;
  receivedAt?: string;
  expiryDate?: string;
  supplierCode?: string;
  notes?: string;
  [key: string]: unknown; // allow extra columns (ignored)
}

// ─── Normalized Row (after parsing + type coercion) ───
export interface LegacyStockNormalizedRow {
  type: LegacyStockType;
  code: string;
  name: string;
  quantity: number;
  unitCost: number;
  category?: InventorySupplyCategory;
  baseUnit?: SupplyBaseUnit;
  origin?: string;
  roastLevel?: RoastLevel;
  netWeightGrams?: number;
  capacityGrams?: number;
  tareWeightGrams?: number;
  lotNumber?: string;
  receivedAt?: Date;
  expiryDate?: Date;
  supplierCode?: string;
  notes?: string;
  rowNumber: number; // 1-based from file (header = row 1)
}

// ─── Validation Result ───
export interface LegacyStockValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export interface LegacyStockValidationWarning {
  field: string;
  message: string;
  value?: unknown;
}

export interface LegacyStockValidatedRow extends LegacyStockNormalizedRow {
  errors: LegacyStockValidationError[];
  warnings: LegacyStockValidationWarning[];
  isValid: boolean;
}

// ─── Dry-Run Resolution ───
export type DryRunAction = "CREATE" | "MATCH" | "ERROR";

export interface LegacyStockDryRunRow extends LegacyStockValidatedRow {
  action: DryRunAction;
  matchedEntityId?: string; // Product.id or InventorySupplyItem.id
  matchedEntityType?: "PRODUCT" | "SUPPLY";
  matchedEntityCode?: string;
}

export interface LegacyStockDryRunSummary {
  totalRows: number;
  validRows: number;
  createCount: number;
  matchCount: number;
  errorCount: number;
}

export interface LegacyStockDryRunResult {
  summary: LegacyStockDryRunSummary;
  rows: LegacyStockDryRunRow[];
}

// ─── Opening Stock Apply Result ───
export type OpeningStockAction = "CREATE" | "MATCH";

export interface OpeningStockRowResult {
  rowNumber: number;
  entityId: string;
  entityType: "PRODUCT" | "SUPPLY";
  code: string;
  action: OpeningStockAction;
  lotId?: string;
  ledgerRefId: string;
  quantity: number;
  unitCost: number;
  openingValue: number;
  error?: string;
}

export interface OpeningStockResult {
  importId: string;
  operationKey: string;
  totalRows: number;
  createdMasters: number;
  matchedMasters: number;
  lotsCreated: number;
  ledgerEntriesCreated: number;
  totalOpeningValue: number;
  rows: OpeningStockRowResult[];
  errors: string[];
}

// ─── File Parsing Options ───
export interface ParseOptions {
  maxRows?: number; // default 5000
  maxFileSizeBytes?: number; // default 5MB
}

// ─── Parser Output ───
export interface ParseResult {
  rawRows: LegacyStockRawRow[];
  errors: string[]; // file-level parse errors
  rowCount: number;
}

// ─── Resolver Context (tenant-scoped, read-only) ───
export interface ResolverContext {
  tenantId: string;
  // read-only accessors
  findProductByCode: (code: string) => Promise<{ id: string; code: string; name: string; type: ProductType } | null>;
  findSupplyItemByCode: (code: string) => Promise<{ id: string; code: string; name: string; category: InventorySupplyCategory } | null>;
  findSupplierByCode: (code: string) => Promise<{ id: string; code: string; name: string } | null>;
}