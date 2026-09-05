import { prisma } from "./prisma";
import { planCapacity, PLAN_CATALOG, type PlanCapacity, type PlanTier } from "./plans";

export interface TenantCapacityContext {
  tenantId: string;
  subscriptionTier: PlanTier;
}

export interface CapacityUsageSnapshot {
  activeUsers: number;
  monthlyRoastBatches: number;
  monthlyInvoices: number;
}

export interface CapacityCheckResult {
  allowed: boolean;
  /** Plan-defined hard limit. Always present so callers can show "X of Y". */
  limit: number;
  /** Current usage at the moment of the check. */
  used: number;
  /** Plan tier the result was evaluated against. */
  tier: PlanTier;
}

export interface CapacityDecision extends CapacityCheckResult {
  reason: "ok" | "limit_exceeded";
}

export function getCapacityFor(tier: PlanTier): PlanCapacity {
  return planCapacity(tier);
}

export async function loadCapacityUsage(
  tenantId: string,
  now: Date = new Date(),
): Promise<CapacityUsageSnapshot> {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const [activeUsers, monthlyRoastBatches, monthlyInvoices] = await Promise.all([
    prisma.user.count({ where: { tenantId, isActive: true } }),
    prisma.parentRoastingBatch.count({
      where: { tenantId, createdAt: { gte: monthStart, lt: monthEnd } },
    }),
    prisma.invoice.count({
      where: { tenantId, createdAt: { gte: monthStart, lt: monthEnd } },
    }),
  ]);
  return { activeUsers, monthlyRoastBatches, monthlyInvoices };
}

function decide(limit: number, used: number, tier: PlanTier): CapacityDecision {
  return {
    allowed: used < limit,
    limit,
    used,
    tier,
    reason: used < limit ? "ok" : "limit_exceeded",
  };
}

export async function canCreateUser(
  context: TenantCapacityContext,
  usage: CapacityUsageSnapshot = {
    activeUsers: 0,
    monthlyRoastBatches: 0,
    monthlyInvoices: 0,
  },
): Promise<CapacityDecision> {
  const cap = planCapacity(context.subscriptionTier);
  return decide(cap.maxUsers, usage.activeUsers, context.subscriptionTier);
}

export async function canRecordRoastBatch(
  context: TenantCapacityContext,
  usage: CapacityUsageSnapshot = {
    activeUsers: 0,
    monthlyRoastBatches: 0,
    monthlyInvoices: 0,
  },
): Promise<CapacityDecision> {
  const cap = planCapacity(context.subscriptionTier);
  return decide(cap.maxMonthlyRoastBatches, usage.monthlyRoastBatches, context.subscriptionTier);
}

export async function canIssueInvoice(
  context: TenantCapacityContext,
  usage: CapacityUsageSnapshot = {
    activeUsers: 0,
    monthlyRoastBatches: 0,
    monthlyInvoices: 0,
  },
): Promise<CapacityDecision> {
  const cap = planCapacity(context.subscriptionTier);
  return decide(cap.maxMonthlyInvoices, usage.monthlyInvoices, context.subscriptionTier);
}

export function hasWhiteLabel(context: Pick<TenantCapacityContext, "subscriptionTier">): boolean {
  return planCapacity(context.subscriptionTier).whiteLabel;
}

export function summarizeCapacity(
  context: TenantCapacityContext,
  usage: CapacityUsageSnapshot,
): {
  tier: PlanTier;
  capacities: PlanCapacity;
  usage: CapacityUsageSnapshot;
  decisions: {
    users: CapacityDecision;
    batches: CapacityDecision;
    invoices: CapacityDecision;
    whiteLabel: boolean;
  };
} {
  return {
    tier: context.subscriptionTier,
    capacities: planCapacity(context.subscriptionTier),
    usage,
    decisions: {
      users: decide(
        planCapacity(context.subscriptionTier).maxUsers,
        usage.activeUsers,
        context.subscriptionTier,
      ),
      batches: decide(
        planCapacity(context.subscriptionTier).maxMonthlyRoastBatches,
        usage.monthlyRoastBatches,
        context.subscriptionTier,
      ),
      invoices: decide(
        planCapacity(context.subscriptionTier).maxMonthlyInvoices,
        usage.monthlyInvoices,
        context.subscriptionTier,
      ),
      whiteLabel: planCapacity(context.subscriptionTier).whiteLabel,
    },
  };
}

export const PLAN_CAPACITY_CATALOG = PLAN_CATALOG;