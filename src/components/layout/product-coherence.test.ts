import { describe, expect, it } from "vitest";

import {
  APP_NAV_SECTIONS,
  canAccessNavigation,
  getActiveNavigation,
} from "./Sidebar";
import {
  SETTINGS_NAVIGATION,
  getVisibleSettingsNavigation,
} from "@/app/(dashboard)/settings/_components/settings-navigation";
import { getSalesChannelLabel } from "@/lib/sales-channel";

const primaryItems = APP_NAV_SECTIONS.flatMap((section) => section.items);

describe("product coherence navigation", () => {
  it("uses five task contexts without duplicating workspace subpages", () => {
    expect(APP_NAV_SECTIONS.map((section) => section.label)).toEqual([
      "Hari ini",
      "Operasional",
      "Komersial",
      "Kontrol",
      "Kelola",
    ]);
    expect(primaryItems.map((item) => item.href)).toEqual([
      "/dashboard",
      "/control-tower",
      "/inventory",
      "/roasting",
      "/produksi",
      "/kasir",
      "/penjualan",
      "/katalog",
      "/keuangan",
      "/laporan",
      "/laporan/akuntansi",
      "/ai-insights",
      "/settings",
    ]);
  });

  it.each([
    ["/gudang/opname", "/inventory"],
    ["/inventory/suppliers", "/inventory"],
    ["/cupping", "/roasting"],
    ["/roasting/profiles", "/roasting"],
    ["/grinding", "/produksi"],
    ["/eksperimen", "/produksi"],
    ["/penjualan/kontrak", "/penjualan"],
    ["/master-data", "/katalog"],
    ["/laporan/akuntansi", "/laporan/akuntansi"],
    ["/ai-insights", "/ai-insights"],
    ["/audit", "/settings"],
    ["/billing", "/settings"],
  ])("keeps %s inside its canonical workspace", (pathname, expectedHref) => {
    expect(getActiveNavigation(pathname, primaryItems)?.href).toBe(expectedHref);
  });

  it("keeps role-aware primary destinations after consolidation", () => {
    expect(canAccessNavigation("/control-tower", "OPERATOR", "BASIC")).toBe(true);
    expect(canAccessNavigation("/produksi", "OPERATOR", "BASIC")).toBe(true);
    expect(canAccessNavigation("/settings", "OPERATOR", "BASIC")).toBe(false);
    expect(canAccessNavigation("/kasir", "CASHIER", "BASIC")).toBe(true);
    expect(canAccessNavigation("/inventory", "CASHIER", "BASIC")).toBe(false);
    expect(canAccessNavigation("/laporan", "OWNER", "BASIC")).toBe(false);
    expect(canAccessNavigation("/laporan/akuntansi", "OWNER", "BASIC")).toBe(true);
    expect(canAccessNavigation("/ai-insights", "OWNER", "BASIC")).toBe(true);
    expect(canAccessNavigation("/laporan", "OWNER", "PRO")).toBe(true);
  });
});

describe("settings coherence", () => {
  it("uses one unique registry for every settings destination", () => {
    const hrefs = SETTINGS_NAVIGATION.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs).toEqual(expect.arrayContaining([
      "/settings/commerce",
      "/settings/integrations/artisan",
      "/settings/portal-customizer",
    ]));
  });

  it("derives visible settings from roles", () => {
    const ownerHrefs = getVisibleSettingsNavigation("OWNER").map((item) => item.href);
    const managerHrefs = getVisibleSettingsNavigation("MANAGER").map((item) => item.href);

    expect(ownerHrefs).toContain("/billing");
    expect(ownerHrefs).toContain("/settings/portal-customizer");
    expect(managerHrefs).toContain("/settings/integrations/artisan");
    expect(managerHrefs).toContain("/audit");
    expect(managerHrefs).not.toContain("/billing");
    expect(managerHrefs).not.toContain("/settings/portal-customizer");
  });
});

describe("customer-facing sales terminology", () => {
  it("maps every active channel to a readable label", () => {
    expect(getSalesChannelLabel("WALK_IN")).toBe("Datang langsung");
    expect(getSalesChannelLabel("STOREFRONT")).toBe("Storefront");
    expect(getSalesChannelLabel("B2B_DIRECT")).toBe("B2B langsung");
    expect(getSalesChannelLabel("FUTURE_CHANNEL")).toBe("FUTURE CHANNEL");
  });
});
