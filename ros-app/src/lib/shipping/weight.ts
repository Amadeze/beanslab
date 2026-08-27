// Canonical shipment weight calculation for national courier shipping.
// Server-only. Never trusts client-provided weights.

import { prisma } from "@/lib/prisma";

export interface CartLineForWeight {
  productId: string;
  offeringVariantId?: string | null;
  quantity: number;
}

export interface WeightCalculationResult {
  merchandiseWeightGrams: number;
  tareGrams: number;
  shipmentWeightGrams: number;
  lineWeights: Array<{
    productId: string;
    offeringVariantId: string | null;
    quantity: number;
    netWeightGrams: number;
    lineWeightGrams: number;
  }>;
}

/**
 * Calculates canonical shipment weight for national courier shipping.
 * Uses server-authoritative product/variant weights — never trusts client input.
 *
 * Weight hierarchy (from canonical domain):
 * - OfferingVariant.netWeightGrams → actual sellable variant package weight
 * - Product.netWeightGrams → base catalog package weight for simple products
 *
 * For national shipping:
 *   itemWeight = offeringVariant ? variant.netWeightGrams : product.netWeightGrams
 *   merchandiseWeightGrams = Σ(itemWeight × quantity)
 *   shipmentWeightGrams = merchandiseWeightGrams + tenant.rajaOngkirTareGrams
 *
 * Rules:
 * - Server derives weight; never trusts client weight
 * - Quantity must be a validated positive integer
 * - Variants and products are tenant-scoped (cross-tenant rows rejected)
 * - Tare comes from tenant settings
 * - Missing/invalid sellable weight → controlled error
 * - Final weight must be a positive finite number
 */
export async function calculateShipmentWeightForTenant(
  tenantId: string,
  lines: CartLineForWeight[],
): Promise<WeightCalculationResult> {
  if (lines.length === 0) {
    throw new Error("Cart lines cannot be empty for weight calculation.");
  }

  const productIds = new Set<string>();
  const variantIds = new Set<string>();

  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new Error(`Quantity must be a positive integer for ${line.productId}.`);
    }
    productIds.add(line.productId);
    if (line.offeringVariantId) {
      variantIds.add(line.offeringVariantId);
    }
  }

  // Fetch products with netWeightGrams and name (tenant-scoped, active).
  const products = await prisma.product.findMany({
    where: {
      id: { in: Array.from(productIds) },
      tenantId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      netWeightGrams: true,
    },
  });

  const productMap = new Map(products.map((p) => [p.id, p]));

  // Fetch offering variants with netWeightGrams and name (tenant-scoped, active).
  const variantMap = new Map<string, { netWeightGrams: number, name: string }>();
  if (variantIds.size > 0) {
    const variants = await prisma.offeringVariant.findMany({
      where: {
        id: { in: Array.from(variantIds) },
        tenantId,
        isActive: true,
      },
      select: {
        id: true,
        packageName: true,
        netWeightGrams: true,
      },
    });
    for (const v of variants) {
      variantMap.set(v.id, { netWeightGrams: Number(v.netWeightGrams), name: v.packageName });
    }
  }

  // Tenant tare grams (server-authoritative).
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { rajaOngkirTareGrams: true },
  });

  if (!tenant) {
    throw new Error("Tenant not found for weight calculation");
  }

  const tareGrams = tenant.rajaOngkirTareGrams ?? 0;
  if (!Number.isInteger(tareGrams) || tareGrams < 0) {
    throw new Error("Konfigurasi berat kemasan (tare) toko tidak valid.");
  }

  const lineWeights: WeightCalculationResult["lineWeights"] = [];
  let merchandiseWeightGrams = 0;

  for (const line of lines) {
    let netWeightGrams: number;
    let itemName = "";

    if (line.offeringVariantId) {
      const variant = variantMap.get(line.offeringVariantId);
      if (!variant) {
        throw new Error(`Varian produk tidak ditemukan atau sudah tidak aktif.`);
      }
      itemName = variant.name;
      netWeightGrams = variant.netWeightGrams;
      if (!netWeightGrams || netWeightGrams <= 0) {
        throw new Error(`Varian "${itemName}" belum memiliki pengaturan berat pengiriman (gram).`);
      }
    } else {
      const product = productMap.get(line.productId);
      if (!product) {
        throw new Error(`Produk tidak ditemukan atau sudah tidak aktif.`);
      }
      itemName = product.name;
      if (product.netWeightGrams == null || Number(product.netWeightGrams) <= 0) {
        throw new Error(`Produk "${itemName}" belum memiliki pengaturan berat pengiriman (gram).`);
      }
      netWeightGrams = Number(product.netWeightGrams);
    }

    if (!Number.isFinite(netWeightGrams) || netWeightGrams <= 0) {
      throw new Error(`Berat bersih untuk "${itemName}" tidak valid.`);
    }

    const lineWeightGrams = netWeightGrams * line.quantity;
    merchandiseWeightGrams += lineWeightGrams;

    lineWeights.push({
      productId: line.productId,
      offeringVariantId: line.offeringVariantId ?? null,
      quantity: line.quantity,
      netWeightGrams,
      lineWeightGrams,
    });
  }

  const shipmentWeightGrams = merchandiseWeightGrams + tareGrams;

  if (!Number.isFinite(shipmentWeightGrams) || shipmentWeightGrams <= 0) {
    throw new Error("Calculated shipment weight is invalid");
  }

  return {
    merchandiseWeightGrams,
    tareGrams,
    shipmentWeightGrams,
    lineWeights,
  };
}