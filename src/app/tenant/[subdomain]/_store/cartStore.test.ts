import { describe, expect, it, beforeEach } from "vitest";
import { useCartStore } from "./cartStore";

// Reset the store between tests
beforeEach(() => {
  useCartStore.setState({ items: {} });
});

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

const baseProduct = {
  productId: "prod-1",
  code: "GB-GAYO-001",
  name: "Gayo Medium Roast",
  imageUrl: null,
  price: 85000,
  grindSize: "MEDIUM" as const,
  customGrindLabel: null,
};

const baseOffering = {
  productId: null,
  offeringId: "off-1",
  variantId: "var-1",
  code: "OF-GAYO-001",
  name: "Gayo Medium",
  imageUrl: null,
  price: 75000,
  grindSize: "WHOLE_BEAN" as const,
  customGrindLabel: null,
  packageName: "Box 250g",
  netWeightGrams: 250,
  roastLevel: "MEDIUM",
};

describe("cart store", () => {
  it("adds a product to the cart", () => {
    const store = useCartStore.getState();
    store.addItem(TENANT_A, { ...baseProduct, id: "p1:WHOLE_BEAN:" });

    const items = useCartStore.getState().items[TENANT_A];
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(1);
    expect(items[0].name).toBe("Gayo Medium Roast");
  });

  it("increments quantity when adding the same product", () => {
    const store = useCartStore.getState();
    store.addItem(TENANT_A, { ...baseProduct, id: "p1:WHOLE_BEAN:" });
    store.addItem(TENANT_A, { ...baseProduct, id: "p1:WHOLE_BEAN:" });

    const items = useCartStore.getState().items[TENANT_A];
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
  });

  it("keeps different grind sizes as separate cart lines", () => {
    const store = useCartStore.getState();
    store.addItem(TENANT_A, { ...baseProduct, id: "p1:WHOLE_BEAN:", grindSize: "WHOLE_BEAN" });
    store.addItem(TENANT_A, { ...baseProduct, id: "p1:ESPRESSO:", grindSize: "ESPRESSO" });

    const items = useCartStore.getState().items[TENANT_A];
    expect(items).toHaveLength(2);
    expect(items[0].grindSize).toBe("WHOLE_BEAN");
    expect(items[1].grindSize).toBe("ESPRESSO");
  });

  it("adds an offering variant to the cart", () => {
    const store = useCartStore.getState();
    store.addItem(TENANT_A, { ...baseOffering, id: "offering:off-1:var-1:WHOLE_BEAN:" });

    const items = useCartStore.getState().items[TENANT_A];
    expect(items).toHaveLength(1);
    expect(items[0].offeringId).toBe("off-1");
    expect(items[0].variantId).toBe("var-1");
    expect(items[0].packageName).toBe("Box 250g");
  });

  it("removes an item from the cart", () => {
    const store = useCartStore.getState();
    store.addItem(TENANT_A, { ...baseProduct, id: "p1:WHOLE_BEAN:" });
    store.removeItem(TENANT_A, "p1:WHOLE_BEAN:");

    const items = useCartStore.getState().items[TENANT_A];
    expect(items).toHaveLength(0);
  });

  it("updates quantity with minimum of 1", () => {
    const store = useCartStore.getState();
    store.addItem(TENANT_A, { ...baseProduct, id: "p1:WHOLE_BEAN:" });
    store.updateQuantity(TENANT_A, "p1:WHOLE_BEAN:", -5);

    const items = useCartStore.getState().items[TENANT_A];
    expect(items[0].quantity).toBe(1);
  });

  it("calculates total items correctly", () => {
    const store = useCartStore.getState();
    store.addItem(TENANT_A, { ...baseProduct, id: "p1:WHOLE_BEAN:" });
    store.addItem(TENANT_A, { ...baseProduct, id: "p1:WHOLE_BEAN:" }); // increments to 2
    store.addItem(TENANT_A, { ...baseOffering, id: "offering:off-1:var-1:WHOLE_BEAN:" }); // 1

    // 2 + 1 = 3
    expect(useCartStore.getState().getTotalItems(TENANT_A)).toBe(3);
  });

  it("calculates total price correctly", () => {
    const store = useCartStore.getState();
    store.addItem(TENANT_A, { ...baseProduct, id: "p1:WHOLE_BEAN:", price: 85000 });
    store.addItem(TENANT_A, { ...baseProduct, id: "p1:WHOLE_BEAN:", price: 85000 });

    // 2 items × 85000 = 170000
    expect(useCartStore.getState().getTotalPrice(TENANT_A)).toBe(170000);
  });

  it("isolates carts by tenant", () => {
    const store = useCartStore.getState();
    store.addItem(TENANT_A, { ...baseProduct, id: "p1:WHOLE_BEAN:" });
    store.addItem(TENANT_B, { ...baseOffering, id: "offering:off-1:var-1:WHOLE_BEAN:" });

    expect(useCartStore.getState().items[TENANT_A]).toHaveLength(1);
    expect(useCartStore.getState().items[TENANT_B]).toHaveLength(1);
    expect(useCartStore.getState().getTotalItems(TENANT_A)).toBe(1);
    expect(useCartStore.getState().getTotalItems(TENANT_B)).toBe(1);
  });

  it("clears only the specified tenant cart", () => {
    const store = useCartStore.getState();
    store.addItem(TENANT_A, { ...baseProduct, id: "p1:WHOLE_BEAN:" });
    store.addItem(TENANT_B, { ...baseOffering, id: "offering:off-1:var-1:WHOLE_BEAN:" });
    store.clearCart(TENANT_A);

    expect(useCartStore.getState().items[TENANT_A]).toHaveLength(0);
    expect(useCartStore.getState().items[TENANT_B]).toHaveLength(1);
  });

  it("returns 0 for empty tenant cart", () => {
    expect(useCartStore.getState().getTotalItems("nonexistent")).toBe(0);
    expect(useCartStore.getState().getTotalPrice("nonexistent")).toBe(0);
  });
});
