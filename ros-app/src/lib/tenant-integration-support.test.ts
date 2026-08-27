import { describe, expect, it } from "vitest";

import { validateMidtransSupportInput } from "./tenant-integration-support";

describe("validateMidtransSupportInput", () => {
  it("accepts a complete sandbox credential pair", () => {
    expect(validateMidtransSupportInput({
      clientKey: "SB-Mid-client-example",
      serverKey: "SB-Mid-server-example",
      isProduction: false,
      environmentChanged: true,
    })).toBeNull();
  });

  it("rejects an environment switch without a complete replacement pair", () => {
    expect(validateMidtransSupportInput({
      serverKey: "Mid-server-example",
      isProduction: true,
      environmentChanged: true,
    })).toContain("Client Key dan Server Key baru");
  });

  it("rejects production credentials in sandbox mode", () => {
    expect(validateMidtransSupportInput({
      clientKey: "Mid-client-example",
      serverKey: "Mid-server-example",
      isProduction: false,
      environmentChanged: false,
    })).toContain("Client Key tidak cocok");
  });

  it("allows rotating only the server key in the same environment", () => {
    expect(validateMidtransSupportInput({
      serverKey: "SB-Mid-server-rotated",
      isProduction: false,
      environmentChanged: false,
    })).toBeNull();
  });
});
