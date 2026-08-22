import { DEFAULT_ROAST_YIELD } from "./operations-planning";

function positive(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function compact(value: number) {
  return String(Math.round(value * 1000) / 1000);
}

export function productionExecutionHref(productId: string, units: number) {
  const quantity = Math.max(1, Math.ceil(positive(units, 1)));
  return `/produksi?productId=${encodeURIComponent(productId)}&units=${quantity}`;
}

export function roastingExecutionHref(outputProductId: string, inputKg: number) {
  return `/roasting?mulai=1&productId=${encodeURIComponent(outputProductId)}&targetKg=${compact(positive(inputKg, 0.001))}`;
}

export type FulfillmentExecutionInput = {
  productId: string;
  productType: string;
  materialOrigin: string | null;
  shortageUnits: number;
  missingKg: number;
};

export function fulfillmentExecution(input: FulfillmentExecutionInput) {
  if (input.productType === "FINISHED_GOODS") {
    const units = Math.max(1, Math.ceil(positive(input.shortageUnits, 1)));
    return {
      label: `Produksi ${units} unit`,
      href: productionExecutionHref(input.productId, units),
      kind: "PRODUCTION" as const,
    };
  }

  if (input.productType === "ROASTED_BEAN" && input.materialOrigin === "INTERNAL_ROAST") {
    const outputKg = positive(input.missingKg, input.shortageUnits);
    const inputKg = outputKg / DEFAULT_ROAST_YIELD;
    return {
      label: `Sangrai ±${compact(inputKg)} kg GB`,
      href: roastingExecutionHref(input.productId, inputKg),
      kind: "ROASTING" as const,
    };
  }

  return {
    label: "Terima stok",
    href: "/inventory?view=receiving",
    kind: "RECEIVING" as const,
  };
}
