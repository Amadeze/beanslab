// =============================================================================
// LEGACY STOCK IMPORTER — VALIDATOR
// =============================================================================
// Pure validation: normalized rows → validated rows with errors/warnings.
// No DB access. Easy to unit test.

import type {
  LegacyStockNormalizedRow,
  LegacyStockValidatedRow,
  LegacyStockValidationError,
  LegacyStockValidationWarning,
  LegacyStockType,
} from "./types";

const SUPPLY_TYPES_REQUIRING_CATEGORY_BASEUNIT: LegacyStockType[] = ["SUPPLY"];

// ─── Helpers ───
function addError(row: LegacyStockValidatedRow, field: string, message: string, value?: unknown) {
  row.errors.push({ field, message, value });
  row.isValid = false;
}

function addWarning(row: LegacyStockValidatedRow, field: string, message: string, value?: unknown) {
  row.warnings.push({ field, message, value });
}

// ─── Main Validator ───
export function validateLegacyStockRows(
  normalizedRows: LegacyStockNormalizedRow[]
): LegacyStockValidatedRow[] {
  // Track duplicate codes within the file
  const codeCounts = new Map<string, number[]>();
  for (const row of normalizedRows) {
    if (row.code) {
      const arr = codeCounts.get(row.code) ?? [];
      arr.push(row.rowNumber);
      codeCounts.set(row.code, arr);
    }
  }

  return normalizedRows.map((row) => {
    const validated: LegacyStockValidatedRow = {
      ...row,
      errors: [],
      warnings: [],
      isValid: true,
    };

    // ── Required fields ──
    if (!row.type || !["GREEN_BEAN", "ROASTED_BEAN", "FINISHED_GOODS", "SUPPLY"].includes(row.type)) {
      addError(validated, "type", `Invalid type: "${row.type}". Must be GREEN_BEAN, ROASTED_BEAN, FINISHED_GOODS, or SUPPLY.`);
    }

    if (!row.code) {
      addError(validated, "code", "Code is required.");
    } else if (!/^[A-Z0-9\-_]{1,64}$/.test(row.code)) {
      addError(validated, "code", "Code must be 1-64 chars, uppercase alphanumeric, dash, or underscore.");
    }

    if (!row.name) {
      addError(validated, "name", "Name is required.");
    } else if (row.name.length > 120) {
      addError(validated, "name", "Name must be ≤ 120 characters.");
    }

    if (row.quantity === undefined || row.quantity === null || !Number.isFinite(row.quantity)) {
      addError(validated, "quantity", "Quantity must be a valid number.");
    } else if (row.quantity <= 0) {
      addError(validated, "quantity", "Quantity must be > 0.");
    }

    if (row.unitCost === undefined || row.unitCost === null || !Number.isFinite(row.unitCost)) {
      addError(validated, "unitCost", "Unit cost must be a valid number.");
    } else if (row.unitCost < 0) {
      addError(validated, "unitCost", "Unit cost must be ≥ 0.");
    }

    // ── Type-specific requirements ──
    const isSupply = row.type === "SUPPLY";
    const isGreenBean = row.type === "GREEN_BEAN";
    const isRoastedBean = row.type === "ROASTED_BEAN";
    const isFinishedGoods = row.type === "FINISHED_GOODS";

    if (isSupply) {
      if (!row.category) {
        addError(validated, "category", "SUPPLY requires category (PACKAGING, INGREDIENT, CONSUMABLE, MERCHANDISE, SPARE_PART, EQUIPMENT, OTHER).");
      } else if (!["PACKAGING", "INGREDIENT", "CONSUMABLE", "MERCHANDISE", "SPARE_PART", "EQUIPMENT", "OTHER"].includes(row.category)) {
        addError(validated, "category", `Invalid SUPPLY category: "${row.category}".`);
      }

      if (!row.baseUnit) {
        addError(validated, "baseUnit", "SUPPLY requires baseUnit (KG, GRAM, LITER, METER, ROLL, PCS, BOX, SET, OTHER).");
      } else if (!["KG", "GRAM", "LITER", "METER", "ROLL", "PCS", "BOX", "SET", "OTHER"].includes(row.baseUnit)) {
        addError(validated, "baseUnit", `Invalid SUPPLY baseUnit: "${row.baseUnit}".`);
      }
    }

    if (isGreenBean || isRoastedBean) {
      if (row.category) addWarning(validated, "category", "GREEN_BEAN/ROASTED_BEAN ignore category (derived from type).");
      if (row.baseUnit) addWarning(validated, "baseUnit", "GREEN_BEAN/ROASTED_BEAN use KG as base unit (quantity is in KG).");
    }

    if (isFinishedGoods) {
      if (row.category) addWarning(validated, "category", "FINISHED_GOODS ignore category.");
      if (row.baseUnit) addWarning(validated, "baseUnit", "FINISHED_GOODS use UNIT as base unit (quantity is in pieces).");
    }

    // ── Optional field validation ──
    if (isGreenBean || isRoastedBean) {
      if (row.roastLevel && !["LIGHT", "MEDIUM", "MEDIUM_DARK", "DARK"].includes(row.roastLevel)) {
        addError(validated, "roastLevel", `Invalid roastLevel: "${row.roastLevel}". Must be LIGHT, MEDIUM, MEDIUM_DARK, or DARK.`);
      }
      if (isRoastedBean && !row.roastLevel) {
        addWarning(validated, "roastLevel", "ROASTED_BEAN should have roastLevel for clarity.");
      }
    }

    if (isSupply && row.category === "PACKAGING") {
      if (row.capacityGrams !== undefined && (row.capacityGrams < 0 || row.capacityGrams > 1_000_000)) {
        addError(validated, "capacityGrams", "capacityGrams must be 0-1,000,000.");
      }
      if (row.tareWeightGrams !== undefined && (row.tareWeightGrams < 0 || row.tareWeightGrams > 1_000_000)) {
        addError(validated, "tareWeightGrams", "tareWeightGrams must be 0-1,000,000.");
      }
    }

    if (row.netWeightGrams !== undefined && (row.netWeightGrams < 0 || row.netWeightGrams > 1_000_000)) {
      addError(validated, "netWeightGrams", "netWeightGrams must be 0-1,000,000.");
    }

    // ── Date validation ──
    if (row.receivedAt && Number.isNaN(row.receivedAt.getTime())) {
      addError(validated, "receivedAt", "Invalid date format. Use YYYY-MM-DD or DD/MM/YYYY.");
    }
    if (row.expiryDate && Number.isNaN(row.expiryDate.getTime())) {
      addError(validated, "expiryDate", "Invalid date format. Use YYYY-MM-DD or DD/MM/YYYY.");
    }

    // ── Duplicate code within file ──
    const dupRows = codeCounts.get(row.code) ?? [];
    if (dupRows.length > 1) {
      addError(validated, "code", `Duplicate code in file (rows: ${dupRows.join(", ")}).`);
    }

    // ── Warnings ──
    if (row.unitCost === 0) {
      addWarning(validated, "unitCost", "Unit cost is 0 — HPP will be 0 until a purchase with cost is recorded.");
    }

    if (row.expiryDate) {
      const daysUntilExpiry = Math.ceil((row.expiryDate.getTime() - Date.now()) / 86_400_000);
      if (daysUntilExpiry < 0) {
        addWarning(validated, "expiryDate", `Expiry date already passed (${Math.abs(daysUntilExpiry)} days ago).`);
      } else if (daysUntilExpiry <= 30) {
        addWarning(validated, "expiryDate", `Expiry date is soon (${daysUntilExpiry} days).`);
      }
    }

    // Lot tracking warning
    const needsLotTracking = isSupply && row.category && ["PACKAGING", "INGREDIENT", "CONSUMABLE"].includes(row.category);
    if (needsLotTracking && !row.lotNumber) {
      addWarning(validated, "lotNumber", `${row.category} typically tracks lot — consider providing lotNumber.`);
    }

    // Supplier code warning
    if (row.supplierCode && !/^[A-Z0-9\-_]{1,32}$/.test(row.supplierCode)) {
      addWarning(validated, "supplierCode", "Supplier code format may not match existing (expected uppercase alphanumeric/dash/underscore).");
    }

    return validated;
  });
}