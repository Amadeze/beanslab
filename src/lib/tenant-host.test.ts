import { describe, expect, it } from "vitest";
import { isReservedTenantSubdomain, tenantStorefrontUrl, tenantSubdomainFromHost } from "./tenant-host";

describe("tenant host routing", () => {
  it("extracts production and local tenant subdomains", () => {
    expect(tenantSubdomainFromHost("senja.roastd.id")).toBe("senja");
    expect(tenantSubdomainFromHost("senja.localhost:3000")).toBe("senja");
  });

  it("does not turn platform or nested hosts into tenants", () => {
    expect(tenantSubdomainFromHost("roastd.id")).toBeNull();
    expect(tenantSubdomainFromHost("www.roastd.id")).toBeNull();
    expect(tenantSubdomainFromHost("foo.bar.roastd.id")).toBeNull();
    expect(isReservedTenantSubdomain("studio")).toBe(true);
  });

  it("builds canonical production and localhost storefront URLs", () => {
    expect(tenantStorefrontUrl("senja")).toBe("https://senja.roastd.id");
    expect(tenantStorefrontUrl("senja", "http://localhost:3000")).toBe("http://senja.localhost:3000");
  });
});
