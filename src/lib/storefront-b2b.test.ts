import { describe, expect, it, vi } from "vitest";
import { loadStorefrontB2bContext, resolveB2bCatalogPrice } from "./storefront-b2b";
import { loadStorefrontCatalog } from "./storefront-catalog";

const NOW = new Date("2026-08-22T00:00:00.000Z");

function dbFixture() {
  return {
    customer: {
      findFirst: vi.fn().mockResolvedValue({
        id: "customer-a",
        name: "Cafe Partner",
        phone: "0812",
        email: "partner@example.com",
        address: "Jayapura",
        tier: "WHOLESALE_SILVER",
      }),
    },
    contract: {
      findFirst: vi.fn().mockResolvedValue({
        id: "contract-a",
        contractNumber: "CTR-001",
        endDate: null,
        allowCredit: true,
        paymentTermsDays: 30,
        prices: [
          { id: "p10", productId: "product-a", tierName: "SILVER", minOrderQty: 10, pricePerUnit: 85_000 },
          { id: "p50", productId: "product-a", tierName: "SILVER", minOrderQty: 50, pricePerUnit: 78_000 },
          { id: "gold", productId: "product-a", tierName: "GOLD", minOrderQty: 10, pricePerUnit: 70_000 },
        ],
      }),
    },
    invoice: { findMany: vi.fn().mockResolvedValue([]) },
  };
}

describe("storefront B2B context", () => {
  it("scopes customer, contract, prices, and recent orders to the token tenant", async () => {
    const db = dbFixture();
    const context = await loadStorefrontB2bContext(db, "tenant-a", {
      tenantId: "tenant-a",
      customerId: "customer-a",
      expiresAt: 2_000_000_000,
    }, NOW);

    expect(context?.contract).toMatchObject({ allowCredit: true, paymentTermsDays: 30 });
    expect(context?.priceBreaksByProduct.get("product-a")).toHaveLength(2);
    expect(db.customer.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: "tenant-a", id: "customer-a", isActive: true }),
    }));
    expect(db.contract.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: "tenant-a", customerId: "customer-a", isActive: true }),
    }));
    expect(db.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: "tenant-a", customerId: "customer-a", salesChannel: "B2B_DIRECT" }),
    }));
  });

  it("rejects a token bound to another tenant before querying data", async () => {
    const db = dbFixture();
    await expect(loadStorefrontB2bContext(db, "tenant-b", {
      tenantId: "tenant-a",
      customerId: "customer-a",
      expiresAt: 2_000_000_000,
    }, NOW)).resolves.toBeNull();
    expect(db.customer.findFirst).not.toHaveBeenCalled();
  });

  it("uses the highest eligible contract break and falls back to customer tier below MOQ", () => {
    const product = { price: 100_000, priceSilver: 90_000, priceGold: 80_000 };
    const breaks = [
      { id: "p10", minQuantity: 10, unitPrice: 85_000, tierName: "SILVER" as const },
      { id: "p50", minQuantity: 50, unitPrice: 78_000, tierName: "SILVER" as const },
    ];
    expect(resolveB2bCatalogPrice(product, "WHOLESALE_SILVER", 9, breaks)).toMatchObject({
      unitPrice: 90_000,
      priceSource: "TIER",
    });
    expect(resolveB2bCatalogPrice(product, "WHOLESALE_SILVER", 60, breaks)).toMatchObject({
      unitPrice: 78_000,
      contractPriceId: "p50",
      priceSource: "CONTRACT",
    });
  });

  it("keeps a private partner SKU out of retail assumptions and exposes its canonical tier breaks", async () => {
    const productFindMany = vi.fn().mockResolvedValue([{
      id: "private-product",
      code: "FG-PRIVATE",
      name: "Private Label Blend",
      type: "FINISHED_GOODS",
      category: "B2B",
      origin: null,
      roastLevel: "MEDIUM",
      description: null,
      imageUrl: null,
      price: 0,
      priceSilver: 90_000,
      priceGold: 80_000,
      stockKg: 0,
      stockUnit: 100,
      recipes: [],
    }]);
    const db = {
      product: { findMany: productFindMany },
      coffeeOffering: { findMany: vi.fn().mockResolvedValue([]) },
      roastingBatch: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const breaks = new Map([["private-product", [
      { id: "p10", minQuantity: 10, unitPrice: 85_000, tierName: "SILVER" as const },
    ]]]);

    const catalog = await loadStorefrontCatalog(db, "tenant-a", {
      b2b: { customerTier: "WHOLESALE_SILVER", priceBreaksByProduct: breaks },
    });

    expect(catalog.products[0]).toMatchObject({
      id: "private-product",
      price: 90_000,
      retailPrice: 0,
      priceSource: "TIER",
      b2bPriceBreaks: [{ id: "p10", minQuantity: 10, unitPrice: 85_000 }],
    });
    expect(productFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: "tenant-a", isActive: true }),
    }));
  });
});
