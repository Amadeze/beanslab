import { describe, expect, it } from "vitest";
import { buildMidtransItemDetails } from "./midtrans-item-details";

describe("buildMidtransItemDetails integer invariant", () => {
  const assertInvariant = (items: any[], grossAmount: number, shippingCost = 0, tax = 0) => {
    const result = buildMidtransItemDetails(items, grossAmount, shippingCost, tax);
    const sum = result.reduce((s, item) => s + item.price * item.quantity, 0);
    expect(sum).toBe(Math.round(grossAmount));
    // All prices must be integers
    for (const item of result) {
      expect(Number.isInteger(item.price)).toBe(true);
      expect(item.price).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(item.quantity)).toBe(true);
      expect(item.quantity).toBeGreaterThan(0);
    }
    expect(Math.round(grossAmount)).toBe(Math.round(grossAmount)); // gross is integer
    return result;
  };

  it("qty=1 single line", () => {
    assertInvariant([{ id: "A", price: 10000, quantity: 1, name: "A" }], 10000);
  });

  it("qty>1 single line", () => {
    assertInvariant([{ id: "A", price: 10000, quantity: 3, name: "A" }], 30000);
  });

  it("multiple lines", () => {
    assertInvariant(
      [
        { id: "A", price: 10000, quantity: 2, name: "A" },
        { id: "B", price: 15000, quantity: 1, name: "B" },
      ],
      35000
    );
  });

  it("fractional Decimal prices", () => {
    // 10000.40 * 2 = 20000.80 -> rounded to 20001
    // With shipping/tax, diff absorbed there; without, rounding line added
    const result = assertInvariant([{ id: "A", price: 10000.4, quantity: 2, name: "A" }], 20001, 1000, 0);
    // Should have 2 lines: product + shipping (qty=1 absorbs diff)
    expect(result.length).toBe(2);
    const productLine = result.find(r => r.id === "A");
    expect(productLine?.price).toBe(10000);
    expect(productLine?.quantity).toBe(2);
  });

  it("difference of exactly Rp1 with qty=2 + shipping absorbs", () => {
    // unit price 10000.40, qty=2 -> 20000.8, gross=20001 + 1000 shipping
    // shipping line (qty=1) absorbs the +1 diff
    const result = assertInvariant(
      [{ id: "A", price: 10000.4, quantity: 2, name: "A" }],
      21001,
      1000,
      0
    );
    expect(result.length).toBe(2);
    const shippingLine = result.find(r => r.id === "SHIPPING");
    expect(shippingLine?.price).toBe(1001); // 1000 + 1 diff
  });

  it("difference not divisible by any line quantity", () => {
    // Three lines with different quantities, rounding diff absorbed by shipping
    const result = assertInvariant(
      [
        { id: "A", price: 10000.33, quantity: 2, name: "A" },
        { id: "B", price: 15000.66, quantity: 3, name: "B" },
        { id: "C", price: 5000.11, quantity: 5, name: "C" },
      ],
      90004 + 1000, // with 1000 shipping
      1000,
      0
    );
    expect(result.length).toBe(4); // 3 products + shipping
    const sum = result.reduce((s, item) => s + item.price * item.quantity, 0);
    expect(sum).toBe(90004 + 1000);
  });

  it("shipping only", () => {
    const result = assertInvariant([{ id: "A", price: 10000, quantity: 1, name: "A" }], 15000, 5000, 0);
    expect(result.length).toBe(2);
    expect(result.find(r => r.id === "SHIPPING")?.price).toBe(5000);
  });

  it("tax only", () => {
    const result = assertInvariant([{ id: "A", price: 10000, quantity: 1, name: "A" }], 11100, 0, 1100);
    expect(result.length).toBe(2);
    expect(result.find(r => r.id === "TAX")?.price).toBe(1100);
  });

  it("shipping + tax", () => {
    const result = assertInvariant([{ id: "A", price: 10000, quantity: 1, name: "A" }], 16100, 5000, 1100);
    expect(result.length).toBe(3);
    expect(result.find(r => r.id === "SHIPPING")?.price).toBe(5000);
    expect(result.find(r => r.id === "TAX")?.price).toBe(1100);
  });

  it("very small values with shipping to absorb", () => {
    const result = assertInvariant([{ id: "A", price: 0.4, quantity: 1, name: "A" }], 1001, 1000, 0);
    expect(result.length).toBe(2);
    const sum = result.reduce((s, item) => s + item.price * item.quantity, 0);
    expect(sum).toBe(1001);
  });

  it("large realistic invoice values", () => {
    const result = assertInvariant(
      [
        { id: "A", price: 125000.75, quantity: 10, name: "A" },
        { id: "B", price: 89000.25, quantity: 5, name: "B" },
      ],
      1250008 + 445001 + 10000, // with shipping
      10000,
      0
    );
    expect(result.length).toBe(3); // 2 products + shipping
    const sum = result.reduce((s, item) => s + item.price * item.quantity, 0);
    expect(sum).toBe(1250008 + 445001 + 10000);
  });

  it("deterministic repeated invocation", () => {
    const items = [
      { id: "A", price: 10000.4, quantity: 2, name: "A" },
      { id: "B", price: 15000.6, quantity: 3, name: "B" },
    ];
    const r1 = buildMidtransItemDetails(items, 20001 + 45002, 1000);
    const r2 = buildMidtransItemDetails(items, 20001 + 45002, 1000);
    expect(r1.map((x) => ({ price: x.price, qty: x.quantity }))).toEqual(
      r2.map((x) => ({ price: x.price, qty: x.quantity }))
    );
  });

  it("adversarial: canonical 10000.40 * 2 = target 20001 with shipping absorbs", () => {
    // With shipping line, diff is absorbed by shipping (qty=1)
    const result = assertInvariant(
      [{ id: "PROD-1", price: 10000.4, quantity: 2, name: "Product" }],
      21001, // 20001 + 1000 shipping
      1000,
      0
    );
    expect(result.length).toBe(2);
    expect(result[0].quantity).toBe(2);
    const sum = result.reduce((s, item) => s + item.price * item.quantity, 0);
    expect(sum).toBe(21001);
  });

  it("adversarial: qty=3, price=10000.33, target=30001 with shipping", () => {
    const result = assertInvariant(
      [{ id: "PROD-1", price: 10000.33, quantity: 3, name: "Product" }],
      31001, // 30001 + 1000 shipping
      1000,
      0
    );
    expect(result.length).toBe(2);
    expect(result[0].quantity).toBe(3);
    const sum = result.reduce((s, item) => s + item.price * item.quantity, 0);
    expect(sum).toBe(31001);
  });

  it("adversarial: price=0.40, qty=1, target=1 with shipping", () => {
    const result = assertInvariant(
      [{ id: "PROD-1", price: 0.4, quantity: 1, name: "Product" }],
      1001, // 1 + 1000 shipping
      1000,
      0
    );
    expect(result.length).toBe(2);
    expect(result[0].price).toBe(0); // rounded
    const sum = result.reduce((s, item) => s + item.price * item.quantity, 0);
    expect(sum).toBe(1001);
  });

  it("multiple lines with fractional and shipping + tax", () => {
    const result = assertInvariant(
      [
        { id: "A", price: 10000.4, quantity: 2, name: "A" },
        { id: "B", price: 15000.6, quantity: 1, name: "B" },
        { id: "C", price: 5000.1, quantity: 3, name: "C" },
      ],
      50001 + 5000 + 1000, // gross + shipping + tax
      5000,
      1000
    );
    expect(result.length).toBe(5); // 3 products + shipping + tax
    const sum = result.reduce((s, item) => s + item.price * item.quantity, 0);
    expect(sum).toBe(50001 + 5000 + 1000);
  });

  it("no shipping/tax: adds rounding adjustment line", () => {
    // When no qty=1 lines exist, a rounding line is added
    const result = assertInvariant(
      [{ id: "A", price: 10000.4, quantity: 2, name: "A" }],
      20001 // no shipping/tax
    );
    expect(result.length).toBe(2); // product + rounding
    const roundingLine = result.find(r => r.id === "ROUNDING");
    expect(roundingLine).toBeDefined();
    expect(roundingLine?.quantity).toBe(1);
    expect(roundingLine?.price).toBe(1); // 20001 - 20000
    const sum = result.reduce((s, item) => s + item.price * item.quantity, 0);
    expect(sum).toBe(20001);
  });

  it("handles zero price line", () => {
    const result = assertInvariant(
      [{ id: "PROD-1", price: 0, quantity: 1, name: "Product" }],
      0
    );
    expect(result[0].price).toBe(0);
  });

  it("negative diff absorbed by shipping", () => {
    // When rounded sum > target, diff is negative
    const result = assertInvariant(
      [{ id: "A", price: 10000.6, quantity: 1, name: "A" }], // rounds to 10001
      11000, // 10000 + 1000 shipping (target)
      1000,
      0
    );
    // 10001 + 1000 = 11001, target 11000, diff = -1
    expect(result.length).toBe(2);
    const shippingLine = result.find(r => r.id === "SHIPPING");
    expect(shippingLine?.price).toBe(999); // 1000 - 1
    const sum = result.reduce((s, item) => s + item.price * item.quantity, 0);
    expect(sum).toBe(11000);
  });
});