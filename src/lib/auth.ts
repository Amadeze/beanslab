import { prisma, withTenant } from "./prisma";
import { getCurrentUser } from "./session";
import { redirect } from "next/navigation";
import type { SessionUser } from "./session";
import { getTenantAccessState } from "./subscription";
import { planHasFeature, type PlanFeature } from "./plans";
import { cache } from "react";
import { canAccessTenantRole } from "./roles";

export const getTenantAccessRecord = cache(async (tenantId: string) =>
  prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      isActive: true,
      subscriptionTier: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      nextBillingDate: true,
      setupCompletedAt: true,
    },
  }),
);

const getValidatedCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return null;

  const currentUser = await prisma.user.findFirst({
    where: {
      id: sessionUser.id,
      tenantId: sessionUser.tenantId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      tenantId: true,
    },
  });
  if (!currentUser) return null;

  return {
    id: currentUser.id,
    name: currentUser.name,
    email: currentUser.email,
    role: currentUser.role,
    tenantId: currentUser.tenantId,
  };
});

export async function requireCurrentUser() {
  const user = await getValidatedCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

/** 
 * Gets the prisma client scoped to the current user's tenant.
 * Use this in all server actions instead of the global prisma.
 */
export async function requireTenantPrisma() {
  const user = await requireCurrentUser();
  const tenant = await getTenantAccessRecord(user.tenantId);

  if (!tenant || !tenant.isActive) {
    redirect("/login");
  }

  const accessState = getTenantAccessState(tenant);
  if (accessState === "INACTIVE") {
    redirect("/login");
  }
  if (accessState === "SUBSCRIPTION_REQUIRED") {
    redirect("/billing");
  }

  return withTenant(user.tenantId);
}

export async function getCurrentTenantId(): Promise<string> {
  return (await requireCurrentUser()).tenantId;
}

export async function requireRole(...allowedRoles: SessionUser["role"][]) {
  const user = await requireCurrentUser();
  if (!canAccessTenantRole(user.role, allowedRoles)) {
    throw new Error(`FORBIDDEN: requires ${allowedRoles.join(" | ")}, got ${user.role}`);
  }
  return user;
}

export async function requireFeature(feature: PlanFeature) {
  const user = await requireCurrentUser();
  const tenant = await getTenantAccessRecord(user.tenantId);
  if (!tenant || !tenant.isActive) {
    redirect("/login");
  }
  const accessState = getTenantAccessState(tenant);
  if (accessState === "INACTIVE") {
    redirect("/login");
  }
  if (accessState === "SUBSCRIPTION_REQUIRED") {
    redirect("/billing");
  }
  if (!planHasFeature(tenant.subscriptionTier, feature)) {
    throw new Error("FEATURE_NOT_AVAILABLE");
  }
  return tenant.subscriptionTier;
}

/** 
 * Retrieves the current user's ID safely.
 */
export async function getSystemUserId(): Promise<string> {
  return (await requireCurrentUser()).id;
}

/**
 * Gets the timezone for the current tenant.
 * Used by report functions to ensure date operations use the correct timezone.
 */
export async function getTenantTimezone(): Promise<string> {
  const user = await requireCurrentUser();
  const tenant = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: { timezone: true },
  });
  return tenant?.timezone ?? "Asia/Jakarta";
}
