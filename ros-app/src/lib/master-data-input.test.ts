import { describe, expect, it } from "vitest";
import {
  customerInputSchema,
  emptyToNull,
  normalizeEmail,
  normalizePhone,
  sameNormalizedPhone,
  supplierInputSchema,
} from "./master-data-input";

describe("master data input", () => {
  it("accepts a customer or supplier with only a useful name", () => {
    expect(customerInputSchema.parse({ name: "Kopi Senja", tier: "RETAIL", isActive: true }).tier).toBe("RETAIL");
    expect(supplierInputSchema.parse({ name: "Gayo Mandiri", isActive: true }).isActive).toBe(true);
  });

  it("trims values and rejects malformed optional email", () => {
    expect(customerInputSchema.parse({ name: "  Kopi Senja  ", email: "", tier: "RETAIL", isActive: true }).name).toBe("Kopi Senja");
    expect(customerInputSchema.safeParse({ name: "Kopi Senja", email: "bukan-email", tier: "RETAIL", isActive: true }).success).toBe(false);
  });

  it("normalizes common Indonesian phone formats", () => {
    expect(normalizePhone("+62 812-3456-7890")).toBe("081234567890");
    expect(normalizePhone("6281234567890")).toBe("081234567890");
    expect(normalizePhone("812 3456 7890")).toBe("081234567890");
    expect(sameNormalizedPhone("+62 812-3456-7890", "081234567890")).toBe(true);
  });

  it("normalizes email and empty optional values", () => {
    expect(normalizeEmail(" OWNER@KOPI.ID ")).toBe("owner@kopi.id");
    expect(emptyToNull("   ")).toBeNull();
  });
});
