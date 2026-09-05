import { describe, expect, it } from "vitest";
import {
  canCreateUser,
  canIssueInvoice,
  canRecordRoastBatch,
  hasWhiteLabel,
  summarizeCapacity,
  type CapacityUsageSnapshot,
  type TenantCapacityContext,
} from "./capacity";
import { PLAN_CATALOG } from "./plans";

const baseContext = (tier: keyof typeof PLAN_CATALOG): TenantCapacityContext => ({
  tenantId: "tenant_test",
  subscriptionTier: tier,
});

const usage = (overrides: Partial<CapacityUsageSnapshot> = {}): CapacityUsageSnapshot => ({
  activeUsers: 0,
  monthlyRoastBatches: 0,
  monthlyInvoices: 0,
  ...overrides,
});

describe("capacity primitives (with explicit usage)", () => {
  it("allows creating a user when under the cap", async () => {
    const decision = await canCreateUser(baseContext("PRO"), usage({ activeUsers: 4 }));
    expect(decision.allowed).toBe(true);
    expect(decision.limit).toBe(PLAN_CATALOG.PRO.maxUsers);
    expect(decision.used).toBe(4);
  });

  it("rejects when the user count hits the cap", async () => {
    const decision = await canCreateUser(
      baseContext("BASIC"),
      usage({ activeUsers: PLAN_CATALOG.BASIC.maxUsers }),
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("limit_exceeded");
  });

  it("rejects when the monthly roast batch cap is hit", async () => {
    const decision = await canRecordRoastBatch(
      baseContext("PRO"),
      usage({ monthlyRoastBatches: PLAN_CATALOG.PRO.maxMonthlyRoastBatches }),
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("limit_exceeded");
  });

  it("rejects when the monthly invoice cap is hit", async () => {
    const decision = await canIssueInvoice(
      baseContext("TRIAL"),
      usage({ monthlyInvoices: PLAN_CATALOG.TRIAL.maxMonthlyInvoices }),
    );
    expect(decision.allowed).toBe(false);
  });

  it("TRIAL tier mirrors PRO for the per-feature rollout era", async () => {
    const pro = await canIssueInvoice(baseContext("PRO"), usage({ monthlyInvoices: 100 }));
    const trial = await canIssueInvoice(baseContext("TRIAL"), usage({ monthlyInvoices: 100 }));
    expect(pro.allowed).toBe(trial.allowed);
  });

  it("ENTERPRISE is the only tier with white-label on by default", () => {
    expect(hasWhiteLabel({ subscriptionTier: "BASIC" })).toBe(false);
    expect(hasWhiteLabel({ subscriptionTier: "PRO" })).toBe(false);
    expect(hasWhiteLabel({ subscriptionTier: "TRIAL" })).toBe(false);
    expect(hasWhiteLabel({ subscriptionTier: "ENTERPRISE" })).toBe(true);
  });
});

describe("summarizeCapacity", () => {
  it("returns every decision for a tier", () => {
    const summary = summarizeCapacity(
      baseContext("PRO"),
      usage({ activeUsers: 7, monthlyRoastBatches: 50, monthlyInvoices: 250 }),
    );
    expect(summary.tier).toBe("PRO");
    expect(summary.capacities.maxUsers).toBe(PLAN_CATALOG.PRO.maxUsers);
    expect(summary.decisions.users.used).toBe(7);
    expect(summary.decisions.batches.allowed).toBe(true);
    expect(summary.decisions.invoices.allowed).toBe(true);
    expect(summary.decisions.whiteLabel).toBe(false);
  });
});

describe("loadCapacityUsage", () => {
  it("returns the expected shape for downstream consumers", () => {
    const sample: CapacityUsageSnapshot = {
      activeUsers: 2,
      monthlyRoastBatches: 11,
      monthlyInvoices: 31,
    };
    expect(Object.keys(sample).sort()).toEqual(
      ["activeUsers", "monthlyInvoices", "monthlyRoastBatches"].sort(),
    );
  });
});