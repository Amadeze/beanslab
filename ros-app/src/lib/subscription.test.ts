import { describe, expect, it } from "vitest";

import { getTenantAccessState, type TenantAccessInput } from "./subscription";

const NOW = new Date("2026-07-16T00:00:00.000Z");

function tenant(
  overrides: Partial<TenantAccessInput> = {},
): TenantAccessInput {
  return {
    isActive: true,
    subscriptionTier: "TRIAL",
    subscriptionStatus: "ACTIVE",
    trialEndsAt: new Date("2026-07-20T00:00:00.000Z"),
    nextBillingDate: null,
    ...overrides,
  };
}

describe("getTenantAccessState", () => {
  it("allows an active trial", () => {
    expect(getTenantAccessState(tenant(), NOW)).toBe("ACTIVE");
  });

  it("blocks an expired trial", () => {
    expect(
      getTenantAccessState(
        tenant({ trialEndsAt: new Date("2026-07-15T00:00:00.000Z") }),
        NOW,
      ),
    ).toBe("SUBSCRIPTION_REQUIRED");
  });

  it("allows legacy trials without an expiry date", () => {
    expect(getTenantAccessState(tenant({ trialEndsAt: null }), NOW)).toBe(
      "ACTIVE",
    );
  });

  it("blocks past-due and expired paid plans", () => {
    expect(
      getTenantAccessState(
        tenant({
          subscriptionTier: "PRO",
          subscriptionStatus: "PAST_DUE",
          trialEndsAt: null,
        }),
        NOW,
      ),
    ).toBe("SUBSCRIPTION_REQUIRED");

    expect(
      getTenantAccessState(
        tenant({
          subscriptionTier: "PRO",
          trialEndsAt: null,
          nextBillingDate: new Date("2026-07-15T00:00:00.000Z"),
        }),
        NOW,
      ),
    ).toBe("SUBSCRIPTION_REQUIRED");
  });

  it("blocks inactive tenants regardless of billing state", () => {
    expect(getTenantAccessState(tenant({ isActive: false }), NOW)).toBe(
      "INACTIVE",
    );
  });
});
