import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { sealData } from "iron-session";

import { SESSION_OPTIONS } from "../../src/lib/session";
import { getTenantAccessState } from "../../src/lib/subscription";

test("product IA groups roasting, settings, and offline cashier correctly", async ({ context, page }) => {
  test.setTimeout(120_000);
  test.skip(!process.env.DATABASE_URL, "DATABASE_URL is required for authenticated IA tests.");
  page.setDefaultTimeout(15_000);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  try {
    const owners = await prisma.user.findMany({
      where: { isActive: true, role: "OWNER", tenant: { isActive: true } },
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
    const owner = owners.find((candidate) => getTenantAccessState(candidate.tenant) === "ACTIVE");
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

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    const appNavigation = page.getByRole("navigation", { name: "Navigasi aplikasi" });
    await expect(appNavigation.getByRole("link", { name: /Kasir/ })).toBeVisible();
    await expect(appNavigation.getByRole("link", { name: "Pasokan & Stok", exact: true })).toBeVisible();
    await expect(appNavigation.getByRole("link", { name: "Katalog", exact: true })).toBeVisible();
    await expect(appNavigation.getByRole("link", { name: /Master Data/ })).toHaveCount(0);
    await expect(appNavigation.getByRole("link", { name: "Produksi & Packing", exact: true })).toBeVisible();
    await expect(appNavigation.getByRole("link", { name: /Profil Roast/ })).toHaveCount(0);
    await expect(appNavigation.getByRole("link", { name: /Mesin Roasting/ })).toHaveCount(0);
    await expect(appNavigation.getByRole("link", { name: /Artisan Sync/ })).toHaveCount(0);

    await page.goto("/roasting", { waitUntil: "networkidle" });
    const roasteryNavigation = page.getByRole("navigation", { name: "Navigasi workspace roastery" });
    await expect(roasteryNavigation).toBeVisible();
    await expect(roasteryNavigation.getByRole("link", { name: "Batch roasting" })).toHaveAttribute("aria-current", "page");
    await expect(roasteryNavigation.getByRole("link", { name: "Produksi & packing" })).toBeVisible();
    await roasteryNavigation.getByRole("link", { name: "Log Roast" }).click();
    await expect(page).toHaveURL(/\/roasting\?tab=profiles$/);
    await expect(page.getByRole("button", { name: /Impor \.alog/ })).toBeVisible();
    await page.screenshot({ path: "test-results/product-ia-roasting-tabs.png", fullPage: false });

    await page.goto("/roasting/roasts", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/roasting\?tab=profiles$/);

    await page.goto("/settings", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Pengaturan", exact: true })).toBeVisible();
    await expect(page.locator('a[href="/settings/machines"]').last()).toBeVisible();
    await expect(page.locator('a[href="/settings/studio"]').last()).toBeVisible();
    await expect(page.locator('a[href="/settings/team"]').last()).toBeVisible();
    await expect(page.locator('a[href="/audit"]').last()).toBeVisible();
    await expect(page.locator('a[href="/billing"]').last()).toBeVisible();
    await page.screenshot({ path: "test-results/product-ia-settings-hub.png", fullPage: false });

    await page.goto("/master-data/machines", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/settings\/machines$/);
    await expect(page.getByRole("heading", { name: "Mesin Roasting", exact: true })).toBeVisible();

    await page.goto("/master-data?tab=supplier", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/inventory\/suppliers$/);
    await expect(page.getByRole("heading", { name: "Pasokan", exact: true })).toBeVisible();

    await page.goto("/master-data?tab=pelanggan", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/penjualan\/pelanggan$/);
    await expect(page.getByRole("heading", { name: "Penjualan", exact: true })).toBeVisible();

    await page.goto("/master-data", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/katalog$/);
    await expect(page.getByRole("heading", { name: "Katalog", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Produk \d+$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Kemasan \d+$/ })).toHaveCount(0);
    await page.screenshot({ path: "test-results/product-ia-catalog.png", fullPage: false });

    await page.goto("/settings/team", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Anggota Tim", exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Navigasi pengaturan" })).toBeVisible();

    await page.goto("/kasir", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Buka Kasir", exact: true })).toBeVisible();
    await expect(page.getByLabel("Daftar produk")).toBeVisible();
    await expect(page.getByLabel("Keranjang kasir")).toBeVisible();
    await page.screenshot({ path: "test-results/cashier-offline-desktop.png", fullPage: false });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/kasir", { waitUntil: "networkidle" });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2);
    await page.getByRole("button", { name: /^Keranjang \d+$/ }).click();
    await expect(page.getByRole("heading", { name: "Keranjang Kasir" })).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "test-results/cashier-offline-mobile.png", fullPage: false });
  } finally {
    await prisma.$disconnect();
  }
});
