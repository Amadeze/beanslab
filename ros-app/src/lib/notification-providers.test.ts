import { describe, expect, it } from "vitest";
import { interpretFonnteResponse, normalizeWhatsAppTarget } from "./notification-providers";

describe("notification providers", () => {
  it("normalizes common Indonesian WhatsApp numbers", () => {
    expect(normalizeWhatsAppTarget("0812-3456-7890")).toBe("6281234567890");
    expect(normalizeWhatsAppTarget("+62 812 3456 7890")).toBe("6281234567890");
  });

  it("rejects malformed destinations", () => {
    expect(normalizeWhatsAppTarget("customer tanpa nomor")).toBeNull();
    expect(normalizeWhatsAppTarget("123")).toBeNull();
  });

  it("does not treat an HTTP 200 provider rejection as delivered", () => {
    expect(interpretFonnteResponse(true, 200, JSON.stringify({ status: false, reason: "device disconnect" })))
      .toEqual({ success: false, error: "Fonnte menolak pesan: device disconnect" });
  });

  it("accepts an explicit Fonnte success response", () => {
    expect(interpretFonnteResponse(true, 200, JSON.stringify({ status: true, id: [123] })))
      .toEqual({ success: true });
  });
});
