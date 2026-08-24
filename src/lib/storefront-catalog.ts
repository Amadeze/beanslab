import type { StorefrontOffering, StorefrontGrindSize } from "./storefront-grind";
import {
  resolveB2bCatalogPrice,
  type B2bPriceBreak,
} from "./storefront-b2b";
import type { CustomerPriceTier } from "./sale-intent";

// Canonical storefront catalog: satu loader + satu lineage resolver yang
// dipakai oleh storefront publik (tenant/[subdomain]/page.tsx), customizer
// preview (/api/portal-theme/products), dan checkout (reserve berjalan di
// storefront-commerce dengan locking terpisah).

// Structural so the helpers work with both PrismaClient and a transaction client.
type StorefrontDb = any;

export const MATERIAL_ORIGIN_BY_SOURCE_MODE = {
  INTERNAL_ROAST: "INTERNAL_ROAST",
  PURCHASED_ROASTED: "PURCHASED_ROASTED",
} as const;

export class LineageResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LineageResolutionError";
  }
}

export type LineageResolution = {
  productId: string;
  avgCostPerKg: number | null;
  roastLevel: string | null;
};

export type OfferingForLineage = {
  id: string;
  tenantId: string;
  coffeeSourceId: string;
  sourceMode: "INTERNAL_ROAST" | "PURCHASED_ROASTED";
  roastLevel: string | null;
  lineageProductId: string | null;
};

// Resolve produk ROASTED_BEAN yang menampung stok/reservasi offering.
// 1. Binding eksplisit (lineageProductId) menang jika valid: milik tenant,
//    bertipe ROASTED_BEAN, dan aktif.
// 2. Tanpa binding: kandidat = produk ROASTED_BEAN aktif milik tenant dengan
//    CoffeeSource sama, materialOrigin sesuai sourceMode, roastLevel cocok
//    (jika offering mencantumkan roast). Wajib tepat satu — ambiguitas ditolak.
// 3. Error menjelaskan akar masalah agar tenant bisa memperbaikinya.
export async function resolveOfferingLineage(
  db: StorefrontDb,
  offering: OfferingForLineage,
): Promise<LineageResolution> {
  if (offering.lineageProductId) {
    const bound = await db.product.findUnique({
      where: { id: offering.lineageProductId },
      select: {
        id: true,
        tenantId: true,
        type: true,
        isActive: true,
        coffeeSourceId: true,
        materialOrigin: true,
        avgCostPerKg: true,
        roastLevel: true,
        sourceGreenBean: {
          select: {
            tenantId: true,
            type: true,
            coffeeSourceId: true,
          },
        },
      },
    });
    if (!bound || bound.tenantId !== offering.tenantId || bound.type !== "ROASTED_BEAN") {
      throw new LineageResolutionError(
        "Produk lineage penawaran ini tidak valid atau bukan roasted bean milik tenant.",
      );
    }
    if (!bound.isActive) {
      throw new LineageResolutionError("Produk lineage penawaran ini sedang nonaktif.");
    }
    const expectedOrigin = MATERIAL_ORIGIN_BY_SOURCE_MODE[offering.sourceMode];
    const roastMatches = !offering.roastLevel || bound.roastLevel === offering.roastLevel;
    if (
      bound.coffeeSourceId !== offering.coffeeSourceId
      || bound.materialOrigin !== expectedOrigin
      || !roastMatches
    ) {
      throw new LineageResolutionError(
        "Produk lineage tidak cocok dengan identitas kopi, asal material, atau roast penawaran.",
      );
    }
    if (
      offering.sourceMode === "INTERNAL_ROAST"
      && (
        !bound.sourceGreenBean
        || bound.sourceGreenBean.tenantId !== offering.tenantId
        || bound.sourceGreenBean.type !== "GREEN_BEAN"
        || bound.sourceGreenBean.coffeeSourceId !== offering.coffeeSourceId
      )
    ) {
      throw new LineageResolutionError(
        "Produk internal roast belum memiliki lineage green bean/roasting yang terbukti.",
      );
    }
    return {
      productId: bound.id,
      avgCostPerKg: bound.avgCostPerKg,
      roastLevel: bound.roastLevel,
    };
  }

  const candidates = await db.product.findMany({
    where: {
      tenantId: offering.tenantId,
      coffeeSourceId: offering.coffeeSourceId,
      type: "ROASTED_BEAN",
      materialOrigin: MATERIAL_ORIGIN_BY_SOURCE_MODE[offering.sourceMode],
      isActive: true,
      ...(offering.roastLevel ? { roastLevel: offering.roastLevel } : {}),
      ...(offering.sourceMode === "INTERNAL_ROAST"
        ? {
            sourceGreenBean: {
              is: {
                tenantId: offering.tenantId,
                type: "GREEN_BEAN",
                coffeeSourceId: offering.coffeeSourceId,
              },
            },
          }
        : {}),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, avgCostPerKg: true, roastLevel: true },
  });
  if (candidates.length === 0) {
    throw new LineageResolutionError(
      offering.sourceMode === "INTERNAL_ROAST"
        ? "Belum ada roasted bean dengan lineage green bean/roasting yang terbukti untuk penawaran ini."
        : "Belum ada stok roasted bean beli jadi untuk penawaran ini. Silakan hubungi roastery.",
    );
  }
  if (candidates.length > 1) {
    throw new LineageResolutionError(
      "Terdapat lebih dari satu produk roasted bean yang cocok; tautkan produk lineage secara eksplisit.",
    );
  }
  return {
    productId: candidates[0].id,
    avgCostPerKg: candidates[0].avgCostPerKg,
    roastLevel: candidates[0].roastLevel,
  };
}

// ─── Canonical catalog payload ───────────────────────────────────────────────

export type CatalogProduct = {
  id: string;
  code: string;
  name: string;
  type: string;
  category: string | null;
  origin: string | null;
  roastLevel: string | null;
  description: string | null;
  imageUrl: string | null;
  price: number | null;
  priceSilver: number | null;
  priceGold: number | null;
  retailPrice?: number | null;
  priceSource?: "BASE" | "TIER" | "CONTRACT";
  b2bPriceBreaks?: B2bPriceBreak[];
  stockKg: number | null;
  stockUnit: number | null;
  recipes: Array<{ storefrontGrindOptions: StorefrontGrindSize[] }>;
  latestRoastDate: string | null; // ISO date string of latest completed roast batch
};

// StorefrontOffering + info ketersediaan real-time (kg) untuk UI.
export type CatalogOffering = StorefrontOffering & {
  lineageProductId: string | null;
  availableKg: number | null;
  unavailableReason: string | null;
  latestRoastDate: string | null; // ISO date string of latest completed roast batch
};

export type StorefrontCatalog = {
  products: CatalogProduct[];
  offerings: CatalogOffering[];
};

// Loader canonical: dipakai storefront publik DAN customizer preview agar
// kedua sisi selalu menampilkan katalog yang sama.
export async function loadStorefrontCatalog(
  db: StorefrontDb,
  tenantId: string,
  options: {
    b2b?: {
      customerTier: CustomerPriceTier;
      priceBreaksByProduct: Map<string, B2bPriceBreak[]>;
    };
  } = {},
): Promise<StorefrontCatalog> {
  const b2bProductIds = options.b2b ? [...options.b2b.priceBreaksByProduct.keys()] : [];
  const productPriceFilter = options.b2b
    ? {
        OR: [
          { price: { gt: 0 } },
          options.b2b.customerTier === "WHOLESALE_GOLD"
            ? { priceGold: { gt: 0 } }
            : { priceSilver: { gt: 0 } },
          ...(b2bProductIds.length > 0 ? [{ id: { in: b2bProductIds } }] : []),
        ],
      }
    : { price: { gt: 0 } };
  const [productRows, offeringRows] = await Promise.all([
    db.product.findMany({
      where: { tenantId, type: "FINISHED_GOODS", isActive: true, ...productPriceFilter },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        category: true,
        origin: true,
        roastLevel: true,
        description: true,
        imageUrl: true,
        price: true,
        priceSilver: true,
        priceGold: true,
        stockKg: true,
        stockUnit: true,
        recipes: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { storefrontGrindOptions: true },
        },
      },
      orderBy: [{ stockKg: "desc" }, { name: "asc" }],
    }),
    db.coffeeOffering.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        tenantId: true,
        code: true,
        name: true,
        description: true,
        imageUrl: true,
        roastLevel: true,
        sourceMode: true,
        coffeeSourceId: true,
        lineageProductId: true,
        grindOptions: true,
        allowCustomGrind: true,
        coffeeSource: {
          select: {
            name: true,
            country: true,
            region: true,
            farm: true,
            species: true,
            varietal: true,
            processMethod: true,
            fermentationMethod: true,
            elevation: true,
            cropYear: true,
            certifications: true,
            tastingNotes: true,
          },
        },
        variants: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            packageName: true,
            netWeightGrams: true,
            unitPrice: true,
          },
        },
      },
    }),
  ]);

  // Pre-fetch latest production dates for FINISHED_GOODS products.
  // ProductionBatch adalah model yang menghasilkan output FG (outputProductId);
  // roasting batch menghasilkan ROASTED_BEAN, bukan FG.
  const productIds = productRows.map((p: Record<string, unknown>) => p.id as string);
  const latestBatches = productIds.length > 0
    ? await db.productionBatch.findMany({
        where: {
          tenantId,
          outputProductId: { in: productIds },
          status: "COMPLETED",
          voidAt: null,
        },
        select: {
          outputProductId: true,
          producedAt: true,
        },
        orderBy: { producedAt: "desc" },
      })
    : [];

  // Map productId -> latest producedAt (entri pertama per produk = terbaru)
  const latestRoastByProduct: Map<string, Date> = new Map();
  for (const batch of latestBatches) {
    if (!latestRoastByProduct.has(batch.outputProductId)) {
      latestRoastByProduct.set(batch.outputProductId, batch.producedAt);
    }
  }

  const products: CatalogProduct[] = productRows.flatMap((product: Record<string, unknown>) => {
    const retailPrice = num(product.price);
    const priceSilver = num(product.priceSilver);
    const priceGold = num(product.priceGold);
    const breaks = options.b2b?.priceBreaksByProduct.get(product.id as string) ?? [];
    const resolved = options.b2b
      ? resolveB2bCatalogPrice({
          price: retailPrice ?? 0,
          priceSilver: priceSilver ?? 0,
          priceGold: priceGold ?? 0,
        }, options.b2b.customerTier, 1, breaks)
      : null;
    const price = resolved?.unitPrice ?? retailPrice;
    if (price === null || price <= 0) return [];
    const latestRoastDate = latestRoastByProduct.get(product.id as string);
    return [{
      id: product.id as string,
      code: product.code as string,
      name: product.name as string,
      type: product.type as string,
      category: product.category as string | null,
      origin: product.origin as string | null,
      roastLevel: product.roastLevel as string | null,
      description: product.description as string | null,
      imageUrl: product.imageUrl as string | null,
      price,
      priceSilver,
      priceGold,
      ...(options.b2b ? {
        retailPrice,
        priceSource: resolved?.priceSource ?? "TIER",
        b2bPriceBreaks: breaks,
      } : {}),
      stockKg: num(product.stockKg),
      stockUnit: num(product.stockUnit),
      recipes: (product.recipes ?? []) as Array<{ storefrontGrindOptions: StorefrontGrindSize[] }>,
      latestRoastDate: latestRoastDate ? latestRoastDate.toISOString() : null,
    }];
  });

  // Resolve lineage + ketersediaan kg per offering.
  const lineageIds: string[] = [];
  const offerings: CatalogOffering[] = [];
  for (const row of offeringRows) {
    const availableKg: number | null = null;
    let unavailableReason: string | null = null;
    let lineageProductId: string | null = null;
    try {
      const resolution = await resolveOfferingLineage(db, row);
      lineageProductId = resolution.productId;
      lineageIds.push(resolution.productId);
    } catch (error) {
      unavailableReason = error instanceof Error ? error.message : "Belum tersedia.";
    }
    offerings.push({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      imageUrl: row.imageUrl,
      roastLevel: row.roastLevel,
      grindOptions: row.grindOptions as StorefrontGrindSize[],
      allowCustomGrind: row.allowCustomGrind,
      coffeeSource: row.coffeeSource,
      variants: row.variants.map((variant: Record<string, unknown>) => ({
        id: variant.id as string,
        packageName: variant.packageName as string,
        netWeightGrams: Number(variant.netWeightGrams),
        unitPrice: Number(variant.unitPrice),
      })),
      availableKg,
      unavailableReason,
      lineageProductId,
      latestRoastDate: lineageProductId ? (latestRoastByProduct.get(lineageProductId)?.toISOString() ?? null) : null,
    });
  }

  if (lineageIds.length > 0) {
    const [stockRows, reservedRows] = await Promise.all([
      db.product.findMany({
        where: { id: { in: lineageIds } },
        select: { id: true, stockKg: true },
      }),
      db.stockReservation.groupBy({
        by: ["productId"],
        where: {
          tenantId,
          productId: { in: lineageIds },
          status: "ACTIVE",
          quantityKg: { not: null },
        },
        _sum: { quantityKg: true },
      }),
    ]);
    const stockByProduct: Map<string, number> = new Map(
      stockRows.map((row: { id: string; stockKg: unknown }) => [row.id, num(row.stockKg) ?? 0]),
    );
    const reservedByProduct: Map<string, number> = new Map(
      reservedRows.map((row: { productId: string; _sum: { quantityKg: unknown } }) => [
        row.productId,
        num(row._sum.quantityKg) ?? 0,
      ]),
    );
    for (const offering of offerings) {
      if (offering.lineageProductId) {
        offering.availableKg = Math.max(
          0,
          (stockByProduct.get(offering.lineageProductId) ?? 0)
            - (reservedByProduct.get(offering.lineageProductId) ?? 0),
        );
      }
    }
  }

  return { products, offerings };
}

function num(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
