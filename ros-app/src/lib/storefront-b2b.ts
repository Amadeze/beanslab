import type { B2bAccessPayload } from "./b2b-access";
import {
  contractTierForCustomer,
  resolveCustomerUnitPrice,
  type CustomerPriceTier,
  type TieredProductPrice,
} from "./sale-intent";

type StorefrontB2bDb = any;

export type B2bPriceBreak = {
  id: string;
  minQuantity: number;
  unitPrice: number;
  tierName: string;
};

export type StorefrontB2bContext = {
  customer: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    tier: CustomerPriceTier;
  };
  contract: {
    id: string;
    contractNumber: string;
    endDate: Date | null;
    allowCredit: boolean;
    paymentTermsDays: number | null;
  };
  priceBreaksByProduct: Map<string, B2bPriceBreak[]>;
  recentOrders: Array<{
    id: string;
    code: string;
    issuedAt: Date;
    grandTotal: number;
    purchaseOrderReference: string | null;
    items: Array<{
      productId: string;
      quantity: number;
      grindSize: string | null;
      customGrindLabel: string | null;
      product: { id: string; code: string; name: string; imageUrl: string | null; isActive: boolean };
    }>;
  }>;
};

export async function loadStorefrontB2bContext(
  db: StorefrontB2bDb,
  tenantId: string,
  access: B2bAccessPayload,
  now = new Date(),
  options: { includeRecentOrders?: boolean } = {},
): Promise<StorefrontB2bContext | null> {
  if (access.tenantId !== tenantId) return null;

  const customer = await db.customer.findFirst({
    where: {
      id: access.customerId,
      tenantId,
      isActive: true,
      tier: { in: ["WHOLESALE_SILVER", "WHOLESALE_GOLD"] },
    },
    select: { id: true, name: true, phone: true, email: true, address: true, tier: true },
  });
  if (!customer) return null;

  const contract = await db.contract.findFirst({
    where: {
      tenantId,
      customerId: customer.id,
      isActive: true,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      contractNumber: true,
      endDate: true,
      allowCredit: true,
      paymentTermsDays: true,
      prices: {
        where: { tenantId },
        select: { id: true, productId: true, tierName: true, minOrderQty: true, pricePerUnit: true },
        orderBy: { minOrderQty: "asc" },
      },
    },
  });
  if (!contract) return null;

  const expectedTier = contractTierForCustomer(customer.tier as CustomerPriceTier);
  const priceBreaksByProduct = new Map<string, B2bPriceBreak[]>();
  for (const price of contract.prices) {
    const unitPrice = Number(price.pricePerUnit ?? 0);
    const minQuantity = Number(price.minOrderQty);
    if (price.tierName !== expectedTier || unitPrice <= 0 || minQuantity <= 0) continue;
    const rows = priceBreaksByProduct.get(price.productId) ?? [];
    rows.push({ id: price.id, minQuantity, unitPrice, tierName: price.tierName });
    priceBreaksByProduct.set(price.productId, rows);
  }

  const recentRows = options.includeRecentOrders === false ? [] : await db.invoice.findMany({
    where: {
      tenantId,
      customerId: customer.id,
      salesChannel: "B2B_DIRECT",
      status: { notIn: ["VOID", "RETURNED"] },
    },
    orderBy: { issuedAt: "desc" },
    take: 5,
    select: {
      id: true,
      code: true,
      issuedAt: true,
      grandTotal: true,
      purchaseOrderReference: true,
      items: {
        where: { offeringId: null },
        select: {
          productId: true,
          quantity: true,
          grindSize: true,
          customGrindLabel: true,
          product: { select: { id: true, code: true, name: true, imageUrl: true, isActive: true } },
        },
      },
    },
  });

  return {
    customer: { ...customer, tier: customer.tier as CustomerPriceTier },
    contract: {
      id: contract.id,
      contractNumber: contract.contractNumber,
      endDate: contract.endDate,
      allowCredit: Boolean(contract.allowCredit && contract.paymentTermsDays),
      paymentTermsDays: contract.paymentTermsDays,
    },
    priceBreaksByProduct,
    recentOrders: recentRows.map((invoice: any) => ({
      ...invoice,
      grandTotal: Number(invoice.grandTotal),
    })),
  };
}

export function resolveB2bCatalogPrice(
  product: TieredProductPrice,
  customerTier: CustomerPriceTier,
  quantity: number,
  breaks: B2bPriceBreak[] = [],
) {
  return resolveCustomerUnitPrice(
    product,
    customerTier,
    quantity,
    breaks.map((price) => ({
      id: price.id,
      tierName: price.tierName,
      minOrderQty: price.minQuantity,
      pricePerUnit: price.unitPrice,
    })),
  );
}

export function addDays(from: Date, days: number) {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}
