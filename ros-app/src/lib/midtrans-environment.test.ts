import { describe, expect, it } from "vitest";
import { midtransSnapUrl } from "./midtrans-environment";

describe("midtransSnapUrl", () => {
  it("recognizes Midtrans sandbox keys", () => {
    expect(midtransSnapUrl({ clientKey: "SB-Mid-client-example" })).toContain("app.sandbox.midtrans.com");
  });

  it("honors an explicit production flag", () => {
    expect(midtransSnapUrl({ clientKey: "SB-Mid-client-example", explicitProduction: "true" })).toBe("https://app.midtrans.com/snap/snap.js");
  });
});
