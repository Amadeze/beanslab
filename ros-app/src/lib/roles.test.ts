import { describe, expect, it } from "vitest";
import { canAccessTenantRole, isTenantOwnerRole } from "./roles";

describe("tenant role access", () => {
  it("treats a superadmin as a tenant owner", () => {
    expect(isTenantOwnerRole("SUPERADMIN")).toBe(true);
    expect(canAccessTenantRole("SUPERADMIN", ["OWNER"])).toBe(true);
    expect(canAccessTenantRole("SUPERADMIN", ["MANAGER", "OPERATOR"])).toBe(true);
  });

  it("keeps regular tenant roles within their allowed roles", () => {
    expect(canAccessTenantRole("MANAGER", ["OWNER", "MANAGER"])).toBe(true);
    expect(canAccessTenantRole("MANAGER", ["OWNER"])).toBe(false);
    expect(isTenantOwnerRole("MANAGER")).toBe(false);
  });
});
