import type { SessionUser } from "./session";

export type AppRole = SessionUser["role"];

export function isTenantOwnerRole(role: string): boolean {
  return role === "OWNER" || role === "SUPERADMIN";
}

export function canAccessTenantRole(
  role: string,
  allowedRoles: readonly string[],
): boolean {
  return role === "SUPERADMIN" || allowedRoles.includes(role);
}
