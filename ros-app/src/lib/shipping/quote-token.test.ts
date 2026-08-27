import { describe, expect, it, vi, beforeEach } from "vitest";

vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", "test-secret-key-for-testing-32chars!!");

import {
  createShippingQuoteToken,
  verifyShippingQuoteToken,
  type ShippingQuotePayload,
} from "./quote-token";

const SAMPLE_PAYLOAD: Omit<ShippingQuotePayload, "issuedAt" | "expiresAt"> = {
  version: 1,
  tenantId: "tenant-123",
  destination: {
    providerId: "1101",
    label: "Jakarta Selatan",
    province: "DKI Jakarta",
    city: "Jakarta Selatan",
    district: "Cilandak",
    subdistrict: "Cipete Selatan",
    postalCode: "12410",
  },
  origin: {
    providerId: "574",
    label: "Bandung",
    province: "Jawa Barat",
    city: "Bandung",
    district: "Coblong",
    subdistrict: "Dago",
    postalCode: "40132",
  },
  courierCode: "jne",
  courierName: "JNE",
  serviceCode: "REG",
  serviceName: "Reguler",
  cost: 15000,
  etd: "2-3",
  shipmentWeightGrams: 700,
  cartFingerprint: "abcdef1234567890abcdef1234567890",
  tareGrams: 200,
};

describe("quote-token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createShippingQuoteToken / verifyShippingQuoteToken", () => {
    it("round-trips a valid payload", () => {
      const token = createShippingQuoteToken(SAMPLE_PAYLOAD);
      const payload = verifyShippingQuoteToken(token);
      expect(payload).not.toBeNull();
      expect(payload!.version).toBe(1);
      expect(payload!.tenantId).toBe("tenant-123");
      expect(payload!.courierCode).toBe("jne");
      expect(payload!.serviceCode).toBe("REG");
      expect(payload!.cost).toBe(15000);
      expect(payload!.shipmentWeightGrams).toBe(700);
      expect(payload!.tareGrams).toBe(200);
      expect(payload!.cartFingerprint).toBe("abcdef1234567890abcdef1234567890");
      expect(payload!.destination.providerId).toBe("1101");
      expect(payload!.origin.providerId).toBe("574");
    });

    it("sets issuedAt and expiresAt", () => {
      const before = Date.now();
      const token = createShippingQuoteToken(SAMPLE_PAYLOAD);
      const payload = verifyShippingQuoteToken(token)!;
      expect(payload.issuedAt).toBeGreaterThanOrEqual(before);
      expect(payload.expiresAt).toBeGreaterThan(payload.issuedAt);
    });

    it("rejects a tampered token", () => {
      const token = createShippingQuoteToken(SAMPLE_PAYLOAD);
      const parts = token.split(":");
      const tampered = [parts[0], parts[1], parts[2], "dGVtcGVyZGF0YQ=="].join(":");
      expect(verifyShippingQuoteToken(tampered)).toBeNull();
    });

    it("rejects a token with invalid prefix", () => {
      expect(verifyShippingQuoteToken("invalid:token")).toBeNull();
    });

    it("rejects a token with wrong number of parts", () => {
      expect(verifyShippingQuoteToken("sqtv1:iv:tag")).toBeNull();
    });

    it("rejects an expired token (16 min TTL)", () => {
      const now = Date.now();
      const token = createShippingQuoteToken(SAMPLE_PAYLOAD, 0);
      // Token was created with 0ms TTL, so it's already expired
      const payload = verifyShippingQuoteToken(token);
      expect(payload).toBeNull();
    });

    it("accepts a token within TTL (14 min)", () => {
      const token = createShippingQuoteToken(SAMPLE_PAYLOAD, 14 * 60 * 1000);
      expect(verifyShippingQuoteToken(token)).not.toBeNull();
    });

    it("rejects payload with invalid version", () => {
      const payload = { ...SAMPLE_PAYLOAD, version: 2 as 1 };
      const token = createShippingQuoteToken(payload);
      expect(verifyShippingQuoteToken(token)).toBeNull();
    });

    it("rejects payload with missing tenantId", () => {
      const payload = { ...SAMPLE_PAYLOAD, tenantId: "" };
      const token = createShippingQuoteToken(payload);
      expect(verifyShippingQuoteToken(token)).toBeNull();
    });

    it("rejects payload with missing courierCode", () => {
      const payload = { ...SAMPLE_PAYLOAD, courierCode: "" };
      const token = createShippingQuoteToken(payload);
      expect(verifyShippingQuoteToken(token)).toBeNull();
    });

    it("rejects payload with non-integer cost", () => {
      const payload = { ...SAMPLE_PAYLOAD, cost: 15000.5 };
      const token = createShippingQuoteToken(payload);
      expect(verifyShippingQuoteToken(token)).toBeNull();
    });

    it("rejects payload with zero cost", () => {
      const payload = { ...SAMPLE_PAYLOAD, cost: 0 };
      const token = createShippingQuoteToken(payload);
      expect(verifyShippingQuoteToken(token)).toBeNull();
    });

    it("rejects payload with negative cost", () => {
      const payload = { ...SAMPLE_PAYLOAD, cost: -100 };
      const token = createShippingQuoteToken(payload);
      expect(verifyShippingQuoteToken(token)).toBeNull();
    });

    it("rejects payload with missing cartFingerprint", () => {
      const payload = { ...SAMPLE_PAYLOAD, cartFingerprint: "" };
      const token = createShippingQuoteToken(payload);
      expect(verifyShippingQuoteToken(token)).toBeNull();
    });

    it("rejects payload with zero shipmentWeightGrams", () => {
      const payload = { ...SAMPLE_PAYLOAD, shipmentWeightGrams: 0 };
      const token = createShippingQuoteToken(payload);
      expect(verifyShippingQuoteToken(token)).toBeNull();
    });
  });
});
