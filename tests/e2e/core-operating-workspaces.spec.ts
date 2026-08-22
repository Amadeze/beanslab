import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { sealData } from "iron-session";

import { SESSION_OPTIONS } from "../../src/lib/session";
import { getTenantAccessState } from "../../src/lib/subscription";

test("core workspaces remain task-ready after the restructure", async ({ context, page }) => {
  test.setTimeout(120_000);
  test.skip(!process.env.DATABASE_URL, "DATABASE_URL is required for authenticated workspace tests.");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  try {
    const owners = await prisma.user.findMany({
      where: {
        isActive: true,
        role: "OWNER",
        tenant: { isActive: true },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        tenantId: true,
        sessionVersion: true,
        tenant: {
          select: {
            isActive: true,
            subscriptionTier: true,
            subscriptionStatus: true,
            trialEndsAt: true,
            nextBillingDate: true,
          },
        },
      },
    });
    const owner = owners.find(
      (candidate) => getTenantAccessState(candidate.tenant) === "ACTIVE",
    );
    test.skip(!owner, "An owner with active tenant access is required.");

    const { tenant: _tenant, ...user } = owner!;
    const sessionCookie = await sealData(
      { user },
      {
        password: SESSION_OPTIONS.password,
        ttl: SESSION_OPTIONS.cookieOptions.maxAge,
      },
    );

    await context.addCookies([
      {
        name: SESSION_OPTIONS.cookieName,
        value: sessionCookie,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    const modules = [
      { path: "/inventory", title: "Pasokan & Stok" },
      { path: "/roasting", title: "Roasting" },
      { path: "/produksi", title: "Produksi & Packing" },
      { path: "/penjualan", title: "Penjualan & Pesanan" },
      { path: "/keuangan", title: "Kas & Piutang" },
      { path: "/katalog", title: "Produk & Resep" },
      { path: "/gudang/visual", title: "Peta Gudang" },
    ] as const;

    await page.setViewportSize({ width: 1440, height: 1000 });
    for (const workspace of modules) {
      await page.goto(workspace.path, { waitUntil: "networkidle" });
      await expect(page.getByRole("heading", { name: workspace.title, exact: true })).toBeVisible();
      await expect(page.getByRole("main").or(page.locator("#main-content")).first()).toBeAttached();
    }

    await page.goto("/inventory", { waitUntil: "networkidle" });
    await page.screenshot({
      path: "test-results/core-workspace-inventory-desktop.png",
      fullPage: false,
    });

    await page.goto("/roasting", { waitUntil: "networkidle" });
    await page.screenshot({
      path: "test-results/core-workspace-roasting-desktop.png",
      fullPage: false,
    });

    await page.goto("/gudang/visual", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Peta Gudang", exact: true })).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Cari lokasi, lot, atau produk" })).toBeVisible();
    await page.screenshot({
      path: "test-results/core-workspace-warehouse-map-desktop.png",
      fullPage: false,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/produksi", { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: "Batch Baru", exact: true })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2);
    await page.screenshot({
      path: "test-results/core-workspace-production-mobile.png",
      fullPage: false,
    });

    await page.goto("/inventory", { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: "Barang Datang", exact: true })).toBeVisible();

    await page.goto("/gudang/visual", { waitUntil: "networkidle" });
    await expect(page.getByRole("combobox", { name: "Pilih area Pasokan" })).toBeVisible();
    const warehouseMapOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(warehouseMapOverflow).toBeLessThanOrEqual(2);
    await page.screenshot({
      path: "test-results/core-workspace-warehouse-map-mobile.png",
      fullPage: false,
    });

    await page.goto("/penjualan", { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: "Nota Baru", exact: true }).first()).toBeVisible();
    await page.screenshot({
      path: "test-results/core-workspace-sales-mobile.png",
      fullPage: false,
    });
  } finally {
    await prisma.$disconnect();
  }
});
