import { prisma, withTenant } from "./prisma";
import { getCurrentUser } from "./session";
import { redirect } from "next/navigation";
import type { SessionUser } from "./session";
import { getTenantAccessState } from "./subscription";
import { planHasFeature, type PlanFeature } from "./plans";
import { cache } from "react";
import { canAccessTenantRole } from "./roles";

function withDbTimeout<T>(promise: Promise<T>, ms: number = 10000, context: string = "Operasi"): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${context} timeout setelah ${ms}ms.`)), ms)
    ),
  ]);
}

export const getTenantAccessRecord = cache(async (tenantId: string) =>
  withDbTimeout(
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
    12000,
    "Gagal memuat tenant: database"
  )
);

/**
 * Validates a session payload against the database.
 * Checks: user exists, isActive=true, tenant matches session, and the session
 * version equals the user's latest sessionVersion (password changes bump the
 * version, invalidating every previously issued stateless session).
 * Returns null when stale, inactive, or tenant mismatch.
 */
export async function validateSessionUser(
  sessionUser: SessionUser,
): Promise<SessionUser | null> {
  const currentUser = await withDbTimeout(
    prisma.user.findFirst({
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
        sessionVersion: true,
      },
    }),
    12000,
    "Validasi sesi: database"
  );
  if (!currentUser) return null;
  if (currentUser.sessionVersion !== sessionUser.sessionVersion) return null;

  return {
    id: currentUser.id,
    name: currentUser.name,
    email: currentUser.email,
    role: currentUser.role,
    tenantId: currentUser.tenantId,
    sessionVersion: currentUser.sessionVersion,
  };
}

/**
 * Returns the current user validated against the database.
 * Checks: user exists, isActive=true, tenant matches session, session version
 * is current. Returns null if not found, inactive, stale, or tenant mismatch.
 * Does NOT redirect or throw — suitable for API routes that need custom JSON responses.
 */
export const getValidatedCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return null;

  return validateSessionUser(sessionUser);
});

export async function requireCurrentUser() {
  const user = await getValidatedCurrentUser();
  if (!user) {
    redirect("/login?error=InvalidState");
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
    redirect("/login?error=AccountDisabled");
  }

  const accessState = getTenantAccessState(tenant);
  if (accessState === "INACTIVE") {
    redirect("/login?error=AccountDisabled");
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
    throw new Error("FORBIDDEN: requires " + allowedRoles.join(" | ") + ", got " + user.role);
  }
  return user;
}

export async function requireFeature(feature: PlanFeature) {
  const user = await requireCurrentUser();
  const tenant = await getTenantAccessRecord(user.tenantId);
  if (!tenant || !tenant.isActive) {
    redirect("/login?error=AccountDisabled");
  }
  const accessState = getTenantAccessState(tenant);
  if (accessState === "INACTIVE") {
    redirect("/login?error=AccountDisabled");
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
