export type CustomerPriceTier = "RETAIL" | "WHOLESALE_SILVER" | "WHOLESALE_GOLD";

export type TieredProductPrice = {
  price: number;
  priceSilver: number;
  priceGold: number;
};

export type ContractUnitPrice = {
  id: string;
  tierName: string;
  minOrderQty: number;
  pricePerUnit: number | null;
};

export type ResolvedCustomerUnitPrice = {
  unitPrice: number;
  contractPriceId: string | null;
  priceSource: "BASE" | "TIER" | "CONTRACT";
  contractTierName: string | null;
};

export function contractTierForCustomer(tier: CustomerPriceTier): "BRONZE" | "SILVER" | "GOLD" {
  if (tier === "WHOLESALE_GOLD") return "GOLD";
  if (tier === "WHOLESALE_SILVER") return "SILVER";
  return "BRONZE";
}

export function resolveContractUnitPrice(
  prices: ContractUnitPrice[],
  customerTier: CustomerPriceTier,
  quantity: number,
): ContractUnitPrice | null {
  const expectedTier = contractTierForCustomer(customerTier);
  return prices
    .filter((price) => (
      price.tierName === expectedTier &&
      price.pricePerUnit !== null &&
      price.pricePerUnit > 0 &&
      price.minOrderQty <= quantity
    ))
    .sort((a, b) => b.minOrderQty - a.minOrderQty)[0] ?? null;
}

export function resolveSalePrice(product: TieredProductPrice, tier: CustomerPriceTier): number {
  const retail = Math.max(0, Number(product.price) || 0);
  const tierPrice = tier === "WHOLESALE_GOLD"
    ? Number(product.priceGold)
    : tier === "WHOLESALE_SILVER"
      ? Number(product.priceSilver)
      : retail;
  return tierPrice > 0 ? tierPrice : retail;
}

export function resolveCustomerUnitPrice(
  product: TieredProductPrice,
  customerTier: CustomerPriceTier,
  quantity: number,
  contractPrices: ContractUnitPrice[] = [],
): ResolvedCustomerUnitPrice {
  const contractPrice = resolveContractUnitPrice(contractPrices, customerTier, quantity);
  if (contractPrice?.pricePerUnit) {
    return {
      unitPrice: contractPrice.pricePerUnit,
      contractPriceId: contractPrice.id,
      priceSource: "CONTRACT",
      contractTierName: contractPrice.tierName,
    };
  }

  return {
    unitPrice: resolveSalePrice(product, customerTier),
    contractPriceId: null,
    priceSource: customerTier === "RETAIL" ? "BASE" : "TIER",
    contractTierName: null,
  };
}

export function findDuplicateSaleProductIds(items: Array<{ productId: string }>): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const item of items) {
    if (seen.has(item.productId)) duplicates.add(item.productId);
    seen.add(item.productId);
  }
  return [...duplicates];
}

export function defaultDueDate(from: Date, days = 14): string {
  const due = new Date(from);
  due.setDate(due.getDate() + days);
  const year = due.getFullYear();
  const month = String(due.getMonth() + 1).padStart(2, "0");
  const day = String(due.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
