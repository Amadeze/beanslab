export type TaxConfig = {
  enabled: boolean;
  rate: number;
};

// Rate PPh default (pola withholding Indonesia) — bisa di-override via customTaxRate.
const PPH_RATES: Record<string, number> = {
  PPH_21: 2.5,
  PPH_23: 2,
  PPH_4_2: 0.5,
};

const PPH_TYPES = ["PPH_21", "PPH_23", "PPH_4_2"] as const;
type PphType = (typeof PPH_TYPES)[number];

export function isPphType(value: string | null | undefined): value is PphType {
  return PPH_TYPES.includes(value as PphType);
}

export function calculateTax(
  subtotal: number,
  invoiceDiscount: number,
  taxType: string | null | undefined,
  customTaxRate: number | null | undefined,
  pphType: string | null | undefined,
  config?: TaxConfig,
) {
  const taxableAmount = Math.max(0, subtotal - invoiceDiscount);
  const isTaxEnabled = config?.enabled ?? true;
  const defaultRate = config?.rate ?? 11;

  let taxRate = 0;
  let effectiveTaxType: string | null = null;

  if (taxType === "PPN" || taxType === "PPN_11" || taxType === "PPN_12") {
    if (isTaxEnabled) {
      if (customTaxRate && customTaxRate > 0) taxRate = customTaxRate;
      else if (taxType === "PPN_12") taxRate = 12;
      else taxRate = defaultRate;
    }
    effectiveTaxType = "PPN";
  } else if (taxType === "CUSTOM") {
    if (isTaxEnabled && customTaxRate && customTaxRate > 0) taxRate = customTaxRate;
    effectiveTaxType = "CUSTOM";
  }

  const taxAmount = (taxableAmount * taxRate) / 100;

  let pphWithholding = 0;
  const withholdingType = isPphType(taxType)
    ? taxType
    : isPphType(pphType) ? pphType : null;
  if (withholdingType) {
    const baseRate = PPH_RATES[withholdingType];
    const rate = customTaxRate && customTaxRate > 0 ? customTaxRate : baseRate;
    pphWithholding = (taxableAmount * rate) / 100;
  }

  return {
    taxAmount,
    taxType: effectiveTaxType ?? taxType ?? null,
    taxRate,
    taxableAmount,
    pphType: withholdingType,
    pphWithholding,
  };
}
