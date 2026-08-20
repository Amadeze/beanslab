import { describe, expect, it, vi, beforeEach } from "vitest";

vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", "test-secret-key-for-testing-32chars!!");

import {
  createOriginSelectionToken,
  verifyOriginSelectionToken,
  destinationToPayload,
  type OriginSelectionPayload,
} from "./origin-token";

const SAMPLE_PAYLOAD: OriginSelectionPayload = {
  providerId: "574",
  label: "Cipete Selatan, Cilandak, Jakarta Selatan, DKI Jakarta, 12410",
  province: "DKI Jakarta",
  city: "Jakarta Selatan",
  district: "Cilandak",
  subdistrict: "Cipete Selatan",
  postalCode: "12410",
  issuedAt: Date.now(),
};

describe("origin-token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createOriginSelectionToken / verifyOriginSelectionToken", () => {
    it("round-trips a valid payload", () => {
      const token = createOriginSelectionToken(SAMPLE_PAYLOAD);
      const verified = verifyOriginSelectionToken(token);
      expect(verified).not.toBeNull();
      expect(verified!.providerId).toBe(SAMPLE_PAYLOAD.providerId);
      expect(verified!.label).toBe(SAMPLE_PAYLOAD.label);
      expect(verified!.province).toBe(SAMPLE_PAYLOAD.province);
      expect(verified!.city).toBe(SAMPLE_PAYLOAD.city);
      expect(verified!.district).toBe(SAMPLE_PAYLOAD.district);
      expect(verified!.subdistrict).toBe(SAMPLE_PAYLOAD.subdistrict);
      expect(verified!.postalCode).toBe(SAMPLE_PAYLOAD.postalCode);
    });

    it("rejects a tampered token", () => {
      const token = createOriginSelectionToken(SAMPLE_PAYLOAD);
      // Tamper with the encrypted payload
      const parts = token.split(":");
      const tampered = parts[0] + ":" + parts[1] + ":" + parts[2] + ":" + "dGVtcGVy" + ":" + parts[4];
      const verified = verifyOriginSelectionToken(tampered);
      expect(verified).toBeNull();
    });

    it("rejects a token with invalid prefix", () => {
      const verified = verifyOriginSelectionToken("invalid:token");
      expect(verified).toBeNull();
    });

    it("rejects a token with wrong format", () => {
      const verified = verifyOriginSelectionToken("ost:v1:iv:tag:data:extra");
      expect(verified).toBeNull();
    });

    it("rejects an expired token (TTL > 24h)", () => {
      const expiredPayload = { ...SAMPLE_PAYLOAD, issuedAt: Date.now() - 25 * 60 * 60 * 1000 };
      const token = createOriginSelectionToken(expiredPayload);
      const verified = verifyOriginSelectionToken(token);
      expect(verified).toBeNull();
    });

    it("accepts a token within TTL (24h)", () => {
      const recentPayload = { ...SAMPLE_PAYLOAD, issuedAt: Date.now() - 12 * 60 * 60 * 1000 };
      const token = createOriginSelectionToken(recentPayload);
      const verified = verifyOriginSelectionToken(token);
      expect(verified).not.toBeNull();
    });
  });

  describe("destinationToPayload", () => {
    it("converts a destination to a payload with issuedAt", () => {
      const dest = {
        providerId: "574",
        label: "Test Label",
        province: "DKI Jakarta",
        city: "Jakarta Selatan",
        district: "Cilandak",
        subdistrict: "Cipete Selatan",
        postalCode: "12410",
      };
      const payload = destinationToPayload(dest);
      expect(payload.providerId).toBe(dest.providerId);
      expect(payload.label).toBe(dest.label);
      expect(payload.province).toBe(dest.province);
      expect(payload.city).toBe(dest.city);
      expect(payload.district).toBe(dest.district);
      expect(payload.subdistrict).toBe(dest.subdistrict);
      expect(payload.postalCode).toBe(dest.postalCode);
      expect(payload.issuedAt).toBeGreaterThan(0);
      expect(payload.issuedAt).toBeLessThanOrEqual(Date.now());
    });
  });
});