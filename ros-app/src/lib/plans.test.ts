import { describe, expect, it } from "vitest";

import { PLAN_CATALOG, planHasFeature } from "./plans";

describe("plan entitlements", () => {
  it("keeps core operations available on every plan", () => {
    for (const tier of Object.keys(PLAN_CATALOG) as Array<keyof typeof PLAN_CATALOG>) {
      expect(planHasFeature(tier, "CORE_OPERATIONS")).toBe(true);
    }
  });

  it("reserves Artisan and advanced reports for trial, pro, and enterprise", () => {
    expect(planHasFeature("BASIC", "ARTISAN")).toBe(false);
    expect(planHasFeature("PRO", "ARTISAN")).toBe(true);
    expect(planHasFeature("TRIAL", "ADVANCED_REPORTS")).toBe(true);
  });

  it("defines stable server-side prices", () => {
    expect(PLAN_CATALOG.BASIC.monthlyPrice).toBe(149_000);
    expect(PLAN_CATALOG.PRO.monthlyPrice).toBe(355_000);
  });
});
