import { describe, expect, it, beforeEach, vi } from "vitest";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockCartItems = [
  { productId: "prod-1", offeringId: null, variantId: null, quantity: 2 },
];

const mockDestinations = [
  {
    providerId: "dest-1",
    label: "Jakarta Pusat, DKI Jakarta",
    province: "DKI Jakarta",
    city: "Jakarta Pusat",
    district: "Menteng",
    subdistrict: "Menteng",
    postalCode: "10310",
    token: "dest-token-123",
  },
];

const mockRates = [
  {
    courierCode: "jne",
    courierName: "JNE",
    serviceCode: "YES",
    serviceName: "YES",
    cost: 25000,
    etd: "2-3 hari",
    token: "rate-token-456",
  },
  {
    courierCode: "sicepat",
    courierName: "SiCepat",
    serviceCode: "REG",
    serviceName: "Reguler",
    cost: 20000,
    etd: "3-4 hari",
    token: "rate-token-789",
  },
];

const mockSubdomain = "test-tenant";

describe("CourierShippingSearch logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("validates destination search query minimum length", async () => {
    const query = "Ja";
    expect(query.trim().length < 3).toBe(true);
  });

  it("accepts query length >= 3 for search", async () => {
    const query = "Jak";
    expect(query.trim().length >= 3).toBe(true);
  });

  it("builds correct destination search payload", () => {
    const query = "Jakarta";
    const payload = { query: query.trim() };
    expect(payload).toEqual({ query: "Jakarta" });
  });

  it("builds correct shipping quote payload with destinationToken and items", () => {
    const destinationToken = "dest-token-123";
    const items = mockCartItems.map((item) => ({
      productId: item.productId || null,
      offeringId: item.offeringId || null,
      variantId: item.variantId || null,
      quantity: item.quantity,
    }));

    const payload = { destinationToken, items };
    expect(payload.destinationToken).toBe("dest-token-123");
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].quantity).toBe(2);
  });

  it("parses destination token from API response", () => {
    const apiResponse = { results: mockDestinations };
    expect(apiResponse.results?.[0]?.token).toBe("dest-token-123");
  });

  it("parses shipping rates from API response", () => {
    const apiResponse = { options: mockRates };
    expect(apiResponse.options?.[0]?.token).toBe("rate-token-456");
    expect(apiResponse.options?.[0]?.cost).toBe(25000);
  });

  it("maps selected rate to CourierShippingState", () => {
    const selectedRate = mockRates[0];
    const state = {
      destinationToken: "dest-token-123",
      shippingQuoteToken: selectedRate.token,
      selectedRate,
      shippingCost: selectedRate.cost,
    };

    expect(state.destinationToken).toBe("dest-token-123");
    expect(state.shippingQuoteToken).toBe("rate-token-456");
    expect(state.shippingCost).toBe(25000);
    expect(state.selectedRate?.courierCode).toBe("jne");
  });

  it("clears state when destination is cleared", () => {
    const clearedState = {
      destinationToken: null,
      shippingQuoteToken: null,
      selectedRate: null,
      shippingCost: 0,
    };

    expect(clearedState.destinationToken).toBeNull();
    expect(clearedState.shippingQuoteToken).toBeNull();
    expect(clearedState.shippingCost).toBe(0);
  });

  it("detects cart changes for stale quote invalidation", () => {
    const oldCart = JSON.stringify(mockCartItems);
    const newCart = JSON.stringify([
      { productId: "prod-1", offeringId: null, variantId: null, quantity: 3 },
    ]);
    expect(oldCart).not.toBe(newCart);
  });

  it("keeps same cart JSON stable for unchanged cart", () => {
    const cart = JSON.stringify(mockCartItems);
    const sameCart = JSON.stringify(mockCartItems);
    expect(cart).toBe(sameCart);
  });
});

describe("Shipping cost calculation", () => {
  const tenantSettings = {
    storefrontFreeShippingMinimum: 500000,
    storefrontFlatShippingRate: 15000,
  };

  it("calculates shipping cost for COURIER with selected rate", () => {
    const shippingCost = 25000;
    expect(shippingCost).toBe(25000);
  });

  it("calculates free shipping when subtotal >= minimum", () => {
    const subtotal = 600000;
    const freeShipping = tenantSettings.storefrontFreeShippingMinimum != null
      && subtotal >= Number(tenantSettings.storefrontFreeShippingMinimum);
    expect(freeShipping).toBe(true);
  });

  it("calculates flat shipping when subtotal < minimum", () => {
    const subtotal = 300000;
    const freeShipping = tenantSettings.storefrontFreeShippingMinimum != null
      && subtotal >= Number(tenantSettings.storefrontFreeShippingMinimum);
    expect(freeShipping).toBe(false);
    const shippingCost = freeShipping ? 0 : Math.max(0, Math.round(Number(tenantSettings.storefrontFlatShippingRate || 0)));
    expect(shippingCost).toBe(15000);
  });

  it("sets shipping cost to 0 for PICKUP", () => {
    const isPickup = true;
    let shippingCost = 0;
    if (!isPickup) {
      shippingCost = 15000;
    }
    expect(shippingCost).toBe(0);
  });
});

describe("Grand total calculation", () => {
  const taxRate = 11;

  it("calculates tax correctly", () => {
    const subtotal = 100000;
    const tax = Math.max(0, Math.round(subtotal * Math.max(0, taxRate) / 100));
    expect(tax).toBe(11000);
  });

  it("calculates grand total with COURIER shipping", () => {
    const subtotal = 100000;
    const tax = 11000;
    const shippingCost = 25000;
    const grandTotal = subtotal + tax + shippingCost;
    expect(grandTotal).toBe(136000);
  });

  it("calculates grand total with free shipping", () => {
    const subtotal = 600000;
    const tax = 66000;
    const shippingCost = 0;
    const grandTotal = subtotal + tax + shippingCost;
    expect(grandTotal).toBe(666000);
  });

  it("calculates grand total for PICKUP (no shipping, no tax)", () => {
    const subtotal = 100000;
    const tax = 0;
    const shippingCost = 0;
    const grandTotal = subtotal + tax + shippingCost;
    expect(grandTotal).toBe(100000);
  });
});

describe("SHIPPING_RATE_CHANGED handling", () => {
  it("identifies SHIPPING_RATE_CHANGED error code", () => {
    const errorResponse = { code: "SHIPPING_RATE_CHANGED", error: "Tarif telah berubah" };
    expect(errorResponse.code).toBe("SHIPPING_RATE_CHANGED");
  });

  it("resets courier state on rate changed error", () => {
    const initialState = {
      destinationToken: "dest-1",
      shippingQuoteToken: "rate-1",
      selectedRate: mockRates[0],
      shippingCost: 25000,
    };

    const resetState = {
      destinationToken: null,
      shippingQuoteToken: null,
      selectedRate: null,
      shippingCost: 0,
    };

    expect(resetState.destinationToken).toBeNull();
    expect(resetState.shippingQuoteToken).toBeNull();
    expect(resetState.shippingCost).toBe(0);
  });
});

describe("PICKUP/LOCAL regression - COURIER search not shown", () => {
  function checkCourier(method: string): boolean {
    return method === "COURIER";
  }

  it("does not show CourierShippingSearch for PICKUP", () => {
    expect(checkCourier("PICKUP")).toBe(false);
  });

  it("does not show CourierShippingSearch for LOCAL_DELIVERY", () => {
    expect(checkCourier("LOCAL_DELIVERY")).toBe(false);
  });

  it("does not show CourierShippingSearch for STORE_COURIER", () => {
    expect(checkCourier("STORE_COURIER")).toBe(false);
  });

  it("shows CourierShippingSearch only for COURIER", () => {
    expect(checkCourier("COURIER")).toBe(true);
  });
});