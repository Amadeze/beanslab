import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  calculateDomesticCost,
  searchDomesticDestination,
  trackWaybill,
  type RajaOngkirClientConfig,
} from "./rajaongkir";
import { ShippingProviderError } from "../errors";

const CONFIG: RajaOngkirClientConfig = { apiKey: "secret-platform-key" };

global.fetch = vi.fn();

function mockFetchOnce(response: Partial<Response> & { json?: () => Promise<unknown>; text?: () => Promise<string> }) {
  (global.fetch as any).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: response.json ?? (async () => ({})),
    text: response.text ?? (async () => ""),
    ...response,
  });
}

describe("rajaongkir provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockReset();
  });

  describe("searchDomesticDestination", () => {
    it("sends the platform API key as the `key` header", async () => {
      mockFetchOnce({
        json: async () => ({
          code: 200,
          data: [
            {
              id: "574",
              province: "DKI Jakarta",
              city: "Jakarta Selatan",
              district: "Cilandak",
              subdistrict: "Cipete Selatan",
              postal_code: "12410",
            },
          ],
        }),
      });

      const results = await searchDomesticDestination("Cilandak", CONFIG);
      expect(results).toHaveLength(1);
      const call = (global.fetch as any).mock.calls[0];
      expect(call[1].headers.key).toBe("secret-platform-key");
    });

    it("normalizes a destination into Roastd-owned shape", async () => {
      mockFetchOnce({
        json: async () => ({
          code: 200,
          data: [
            {
              id: "574",
              province: "DKI Jakarta",
              city: "Jakarta Selatan",
              district: "Cilandak",
              subdistrict: "Cipete Selatan",
              postal_code: "12410",
            },
          ],
        }),
      });

      const [dest] = await searchDomesticDestination("Cilandak", CONFIG);
      expect(dest).toEqual({
        providerId: "574",
        label: "Cipete Selatan, Cilandak, Jakarta Selatan, DKI Jakarta, 12410",
        province: "DKI Jakarta",
        city: "Jakarta Selatan",
        district: "Cilandak",
        subdistrict: "Cipete Selatan",
        postalCode: "12410",
      });
    });

    it("never leaks the API key in the normalized result", async () => {
      mockFetchOnce({
        json: async () => ({
          code: 200,
          data: [{ id: "1", province: "X", city: "Y", district: "Z" }],
        }),
      });
      const results = await searchDomesticDestination("Yogya", CONFIG);
      expect(JSON.stringify(results)).not.toContain("secret-platform-key");
    });

    it("rejects a too-short query", async () => {
      await expect(searchDomesticDestination("ya", CONFIG)).rejects.toBeInstanceOf(
        ShippingProviderError,
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("throws EMPTY_RESULT on empty data", async () => {
      mockFetchOnce({ json: async () => ({ code: 200, data: [] }) });
      const err = await searchDomesticDestination("Atambua", CONFIG).catch((e) => e);
      expect(err).toBeInstanceOf(ShippingProviderError);
      expect((err as ShippingProviderError).code).toBe("PROVIDER_EMPTY_RESULT");
    });
  });

  describe("calculateDomesticCost", () => {
    it("normalizes rates across couriers/services", async () => {
      mockFetchOnce({
        json: async () => ({
          code: 200,
          data: [
            {
              code: "jne",
              name: "JNE",
              costs: [
                {
                  service: "REG",
                  description: "Layanan Reguler",
                  cost: [{ value: 12000, etd: "2-3", note: "barang" }],
                },
              ],
            },
          ],
        }),
      });

      const rates = await calculateDomesticCost(
        { origin: "574", destination: "574", weight: 1000, courier: "jne" },
        CONFIG,
      );
      expect(rates).toHaveLength(1);
      expect(rates[0]).toMatchObject({
        courierCode: "jne",
        courierName: "JNE",
        serviceCode: "REG",
        serviceName: "Layanan Reguler",
        cost: 12000,
        etd: "2-3",
      });
      const call = (global.fetch as any).mock.calls[0];
      expect(call[1].body).toContain("weight=1000");
      expect(call[1].body).toContain("courier=jne");
    });

    it("throws EMPTY_RESULT when no rates returned", async () => {
      mockFetchOnce({ json: async () => ({ code: 200, data: [] }) });
      const err = await calculateDomesticCost(
        { origin: "574", destination: "574", weight: 1000, courier: "jne" },
        CONFIG,
      ).catch((e) => e);
      expect((err as ShippingProviderError).code).toBe("PROVIDER_EMPTY_RESULT");
    });
  });

  describe("trackWaybill", () => {
    it("returns a minimal summary without raw details", async () => {
      mockFetchOnce({
        json: async () => ({
          code: 200,
          data: {
            summary: { awb: "123", courier: "jne", status: "DELIVERED" },
            details: [{ raw: "secret" }],
          },
        }),
      });

      const summary = await trackWaybill({ awb: "123", courier: "jne" }, CONFIG);
      expect(summary).toEqual({ awb: "123", courier: "jne", status: "DELIVERED" });
      expect(JSON.stringify(summary)).not.toContain("raw");
    });

    it("serializes lastPhoneNumber when supplied", async () => {
      mockFetchOnce({
        json: async () => ({
          code: 200,
          data: { summary: { awb: "123", courier: "jne", status: "DELIVERED" } },
        }),
      });

      await trackWaybill(
        { awb: "123", courier: "jne", lastPhoneNumber: "08123456789" },
        CONFIG,
      );
      const body = (global.fetch as any).mock.calls[0][1].body as string;
      expect(body).toContain("last_phone_number=08123456789");
      expect(body).toContain("awb=123");
      expect(body).toContain("courier=jne");
      // The key must never leak into the request body.
      expect(body).not.toContain("secret-platform-key");
    });
  });

  describe("error handling", () => {
    it("401 → PROVIDER_UNAUTHORIZED", async () => {
      (global.fetch as any).mockResolvedValueOnce({ ok: false, status: 401 });
      const err = await searchDomesticDestination("Jakarta", CONFIG).catch((e) => e);
      expect((err as ShippingProviderError).code).toBe("PROVIDER_UNAUTHORIZED");
    });

    it("429 → PROVIDER_RATE_LIMITED", async () => {
      (global.fetch as any).mockResolvedValueOnce({ ok: false, status: 429 });
      const err = await searchDomesticDestination("Jakarta", CONFIG).catch((e) => e);
      expect((err as ShippingProviderError).code).toBe("PROVIDER_RATE_LIMITED");
    });

    it("500 → PROVIDER_SERVER_ERROR", async () => {
      (global.fetch as any).mockResolvedValueOnce({ ok: false, status: 503 });
      const err = await searchDomesticDestination("Jakarta", CONFIG).catch((e) => e);
      expect((err as ShippingProviderError).code).toBe("PROVIDER_SERVER_ERROR");
    });

    it("400 → PROVIDER_BAD_REQUEST", async () => {
      (global.fetch as any).mockResolvedValueOnce({ ok: false, status: 404 });
      const err = await searchDomesticDestination("Jakarta", CONFIG).catch((e) => e);
      expect((err as ShippingProviderError).code).toBe("PROVIDER_BAD_REQUEST");
    });

    it("malformed JSON → PROVIDER_INVALID_RESPONSE", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("unexpected token");
        },
      });
      const err = await searchDomesticDestination("Jakarta", CONFIG).catch((e) => e);
      expect((err as ShippingProviderError).code).toBe("PROVIDER_INVALID_RESPONSE");
    });

    it("timeout → PROVIDER_TIMEOUT", async () => {
      (global.fetch as any).mockRejectedValueOnce(
        new DOMException("timeout", "TimeoutError"),
      );
      const err = await searchDomesticDestination("Jakarta", CONFIG).catch((e) => e);
      expect((err as ShippingProviderError).code).toBe("PROVIDER_TIMEOUT");
    });

    it("never includes the API key in the error", async () => {
      (global.fetch as any).mockResolvedValueOnce({ ok: false, status: 500 });
      const err = await searchDomesticDestination("Jakarta", CONFIG).catch((e) => e);
      expect(err.message).not.toContain("secret-platform-key");
    });
  });
});
