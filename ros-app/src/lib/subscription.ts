import { getCurrentDate } from "@/lib/date-utils";
export type TenantAccessInput = {
  isActive: boolean;
  subscriptionTier: "TRIAL" | "BASIC" | "PRO" | "ENTERPRISE";
  subscriptionStatus: "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED";
  trialEndsAt: Date | null;
  nextBillingDate: Date | null;
};

export type TenantAccessState =
  | "ACTIVE"
  | "INACTIVE"
  | "SUBSCRIPTION_REQUIRED";

export function getTenantAccessState(
  tenant: TenantAccessInput,
  now = getCurrentDate(),
): TenantAccessState {
  if (!tenant.isActive) return "INACTIVE";

  const trialExpired =
    tenant.subscriptionTier === "TRIAL" &&
    tenant.trialEndsAt !== null &&
    tenant.trialEndsAt <= now;
  const paidPlanExpired =
    tenant.subscriptionTier !== "TRIAL" &&
    tenant.nextBillingDate !== null &&
    tenant.nextBillingDate <= now;

  if (
    tenant.subscriptionStatus !== "ACTIVE" ||
    trialExpired ||
    paidPlanExpired
  ) {
    return "SUBSCRIPTION_REQUIRED";
  }

  return "ACTIVE";
}
