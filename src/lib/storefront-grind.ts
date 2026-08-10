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

export function aggregateStorefrontStock(
  lines: Array<{ productId: string; quantity: number }>,
) {
  const quantities = new Map<string, number>();
  for (const line of lines) {
    quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.quantity);
  }
  return Array.from(quantities, ([productId, quantity]) => ({ productId, quantity }));
}
