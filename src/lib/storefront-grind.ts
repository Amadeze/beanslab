export const STOREFRONT_GRIND_SIZES = [
  "WHOLE_BEAN",
  "COARSE",
  "MEDIUM_COARSE",
  "MEDIUM",
  "MEDIUM_FINE",
  "FINE",
  "ESPRESSO",
  "CUSTOM",
] as const;

export type StorefrontGrindSize = (typeof STOREFRONT_GRIND_SIZES)[number];

export const STOREFRONT_GRIND_LABEL: Record<StorefrontGrindSize, string> = {
  WHOLE_BEAN: "Biji utuh",
  COARSE: "Kasar / cold brew",
  MEDIUM_COARSE: "Sedang-kasar / V60",
  MEDIUM: "Sedang / filter",
  MEDIUM_FINE: "Sedang-halus / AeroPress",
  FINE: "Halus",
  ESPRESSO: "Espresso",
  CUSTOM: "Ukuran custom",
};

export function normalizeStorefrontGrind(
  grindSize: StorefrontGrindSize,
  customGrindLabel: string | undefined,
  allowed: StorefrontGrindSize[],
) {
  if (!allowed.includes(grindSize)) {
    throw new Error("Pilihan gilingan tidak tersedia untuk produk ini.");
  }
  const customLabel = customGrindLabel?.trim() || null;
  if (grindSize === "CUSTOM" && !customLabel) {
    throw new Error("Catatan gilingan custom wajib diisi.");
  }
  return {
    grindSize,
    customGrindLabel: grindSize === "CUSTOM" ? customLabel : null,
  };
}

export function storefrontLineId(
  productId: string,
  grindSize: StorefrontGrindSize,
  customGrindLabel: string | null,
) {
  return `${productId}:${grindSize}:${customGrindLabel?.trim().toLocaleLowerCase("id-ID") ?? ""}`;
}

// ─── Coffee offerings (katalog penawaran kopi) ──────────────────────────────
// Line id for offering lines is namespaced so it can never collide with the
// product-based line id format above.

export function offeringLineId(
  offeringId: string,
  variantId: string,
  grindSize: StorefrontGrindSize,
  customGrindLabel: string | null,
) {
  return `offering:${offeringId}:${variantId}:${grindSize}:${customGrindLabel?.trim().toLocaleLowerCase("id-ID") ?? ""}`;
}

export function isOfferingLineId(lineId: string) {
  return lineId.startsWith("offering:");
}

// Client-serialized shape of a coffee offering (storefront read model).
export type StorefrontOffering = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  roastLevel: string | null;
  grindOptions: StorefrontGrindSize[];
  allowCustomGrind: boolean;
  coffeeSource: { name: string } | null;
  variants: Array<{
    id: string;
    packageName: string;
    netWeightGrams: number;
    unitPrice: number;
  }>;
};

// Immutable snapshot contract for an offering line. Persisted on InvoiceItem
// at checkout time so later edits to the offering/variant never rewrite history.
export type OfferingSnapshot = {
  offeringId: string;
  offeringName: string;
  packageName: string;
  netWeightGrams: number;
  roastLevel: string | null;
};

export function buildOfferingSnapshot(fields: {
  offeringId: string;
  offeringName: string;
  packageName: string;
  netWeightGrams: number;
  roastLevel: string | null;
}): OfferingSnapshot {
  return {
    offeringId: fields.offeringId,
    offeringName: fields.offeringName,
    packageName: fields.packageName,
    netWeightGrams: fields.netWeightGrams,
    roastLevel: fields.roastLevel ?? null,
  };
}

// Reserved stock for an offering is held in kg on the lineage roasted bean
// product (1 stock unit = 1 kg). `units` is the ceiling for reservation
// quantity (integer, min 1); `quantityKg` is the exact weight with 3 decimals.
export function offeringReserveKg(packageCount: number, netWeightGrams: number) {
  const quantityKg = Math.round((packageCount * netWeightGrams / 1000) * 1000) / 1000;
  return { quantityKg, units: Math.max(1, Math.ceil(quantityKg)) };
}

export function aggregateStorefrontStock(
  lines: Array<{ productId: string; quantity: number }>,
) {
  const quantities = new Map<string, number>();
  for (const line of lines) {
    quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.quantity);
  }
  return Array.from(quantities, ([productId, quantity]) => ({ productId, quantity }));
}
