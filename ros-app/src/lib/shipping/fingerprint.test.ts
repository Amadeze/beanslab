import { describe, expect, it } from "vitest";
import { createCartFingerprint, verifyCartFingerprint, type CartFingerprintInput } from "./fingerprint";

const BASE_INPUT: CartFingerprintInput = {
  tenantId: "t1",
  originProviderId: "574",
  destinationProviderId: "1101",
  tareGrams: 200,
  lines: [
    { productId: "p1", quantity: 2, netWeightGrams: 250, unitPrice: 50000 },
    { productId: "p2", offeringVariantId: "v1", quantity: 1, netWeightGrams: 500, unitPrice: 120000 },
  ],
};

describe("createCartFingerprint", () => {
  it("returns a deterministic 32-char hex string", () => {
    const a = createCartFingerprint(BASE_INPUT);
    const b = createCartFingerprint({ ...BASE_INPUT });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
  });

  it("is order-independent (lines sorted deterministically)", () => {
    const swapped = { ...BASE_INPUT, lines: [...BASE_INPUT.lines].reverse() };
    expect(createCartFingerprint(swapped)).toBe(createCartFingerprint(BASE_INPUT));
  });

  it("normalizes offering lines: productId is irrelevant when variantId is set", () => {
    const withJunk: CartFingerprintInput = {
      ...BASE_INPUT,
      lines: [
        { productId: "JUNK", offeringVariantId: "v1", quantity: 1, netWeightGrams: 500, unitPrice: 120000 },
        { productId: "p1", quantity: 2, netWeightGrams: 250, unitPrice: 50000 },
      ],
    };
    const withNull: CartFingerprintInput = {
      ...BASE_INPUT,
      lines: [
        { productId: "", offeringVariantId: "v1", quantity: 1, netWeightGrams: 500, unitPrice: 120000 },
        { productId: "p1", quantity: 2, netWeightGrams: 250, unitPrice: 50000 },
      ],
    };
    const fp = createCartFingerprint(BASE_INPUT);
    expect(createCartFingerprint(withJunk)).toBe(fp);
    expect(createCartFingerprint(withNull)).toBe(fp);
  });

  it("changes on quantity diff", () => {
    const changed = { ...BASE_INPUT, lines: BASE_INPUT.lines.map((l) => l.productId === "p1" ? { ...l, quantity: 3 } : l) };
    expect(createCartFingerprint(changed)).not.toBe(createCartFingerprint(BASE_INPUT));
  });

  it("changes on netWeightGrams diff", () => {
    const changed = { ...BASE_INPUT, lines: BASE_INPUT.lines.map((l) => l.productId === "p1" ? { ...l, netWeightGrams: 300 } : l) };
    expect(createCartFingerprint(changed)).not.toBe(createCartFingerprint(BASE_INPUT));
  });

  it("changes on unitPrice diff", () => {
    const changed = { ...BASE_INPUT, lines: BASE_INPUT.lines.map((l) => l.productId === "p1" ? { ...l, unitPrice: 55000 } : l) };
    expect(createCartFingerprint(changed)).not.toBe(createCartFingerprint(BASE_INPUT));
  });

  it("changes on tareGrams diff", () => {
    expect(createCartFingerprint({ ...BASE_INPUT, tareGrams: 300 })).not.toBe(createCartFingerprint(BASE_INPUT));
  });

  it("changes on origin diff", () => {
    expect(createCartFingerprint({ ...BASE_INPUT, originProviderId: "575" })).not.toBe(createCartFingerprint(BASE_INPUT));
  });

  it("changes on destination diff", () => {
    expect(createCartFingerprint({ ...BASE_INPUT, destinationProviderId: "1102" })).not.toBe(createCartFingerprint(BASE_INPUT));
  });

  it("changes on tenantId diff", () => {
    expect(createCartFingerprint({ ...BASE_INPUT, tenantId: "t2" })).not.toBe(createCartFingerprint(BASE_INPUT));
  });

  it("changes on variantId diff", () => {
    const changed: CartFingerprintInput = {
      ...BASE_INPUT,
      lines: [
        { productId: "p1", quantity: 2, netWeightGrams: 250, unitPrice: 50000 },
        { productId: "p2", offeringVariantId: "v2", quantity: 1, netWeightGrams: 500, unitPrice: 120000 },
      ],
    };
    expect(createCartFingerprint(changed)).not.toBe(createCartFingerprint(BASE_INPUT));
  });

  it("changes on new offering line added", () => {
    const added: CartFingerprintInput = {
      ...BASE_INPUT,
      lines: [...BASE_INPUT.lines, { productId: "p3", offeringVariantId: "v2", quantity: 1, netWeightGrams: 100, unitPrice: 25000 }],
    };
    expect(createCartFingerprint(added)).not.toBe(createCartFingerprint(BASE_INPUT));
  });
});

describe("verifyCartFingerprint", () => {
  it("returns true for matching input", () => {
    const fp = createCartFingerprint(BASE_INPUT);
    expect(verifyCartFingerprint(fp, BASE_INPUT)).toBe(true);
  });

  it("returns false for tampered input", () => {
    const fp = createCartFingerprint(BASE_INPUT);
    const tampered = { ...BASE_INPUT, tareGrams: 999 };
    expect(verifyCartFingerprint(fp, tampered)).toBe(false);
  });
});
