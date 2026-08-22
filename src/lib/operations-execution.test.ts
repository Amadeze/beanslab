import { describe, expect, it } from "vitest";
import {
  fulfillmentExecution,
  productionExecutionHref,
  roastingExecutionHref,
} from "./operations-execution";

describe("operations execution links", () => {
  it("opens production with the recommended SKU and rounded-up units", () => {
    expect(productionExecutionHref("fg/250", 12.2)).toBe("/produksi?productId=fg%2F250&units=13");
  });

  it("opens roasting with the output SKU and required green-bean input", () => {
    expect(roastingExecutionHref("rb-medium", 4.0625)).toBe(
      "/roasting?mulai=1&productId=rb-medium&targetKg=4.063",
    );
  });

  it("routes finished-goods shortages to production", () => {
    expect(fulfillmentExecution({
      productId: "fg",
      productType: "FINISHED_GOODS",
      materialOrigin: null,
      shortageUnits: 4,
      missingKg: 0,
    })).toMatchObject({ kind: "PRODUCTION", href: "/produksi?productId=fg&units=4" });
  });

  it("converts roasted output demand to conservative green-bean input", () => {
    expect(fulfillmentExecution({
      productId: "rb",
      productType: "ROASTED_BEAN",
      materialOrigin: "INTERNAL_ROAST",
      shortageUnits: 2,
      missingKg: 2.5,
    })).toMatchObject({ kind: "ROASTING", href: "/roasting?mulai=1&productId=rb&targetKg=3.049" });
  });

  it("routes purchased material shortages to receiving", () => {
    expect(fulfillmentExecution({
      productId: "rb-purchased",
      productType: "ROASTED_BEAN",
      materialOrigin: "PURCHASED_ROASTED",
      shortageUnits: 1,
      missingKg: 1,
    })).toEqual({ kind: "RECEIVING", label: "Terima stok", href: "/inventory?view=receiving" });
  });
});
