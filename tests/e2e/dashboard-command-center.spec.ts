import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { sealData } from "iron-session";

import { SESSION_OPTIONS } from "../../src/lib/session";
import { getTenantAccessState } from "../../src/lib/subscription";

test("dashboard operations workbench renders on desktop and mobile", async ({ context, page }) => {
  test.setTimeout(90_000);
  test.skip(!process.env.DATABASE_URL, "DATABASE_URL is required for authenticated dashboard tests.");

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

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await expect(page.getByTestId("operations-workbench")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pekerjaan berikutnya" })).toBeVisible();
    await page.screenshot({
      path: "test-results/dashboard-command-center-desktop.png",
      fullPage: false,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await expect(page.getByTestId("operations-workbench")).toBeVisible();
    const mobileNavigation = page.getByRole("navigation", { name: "Navigasi utama mobile" });
    await expect(mobileNavigation).toBeVisible();
    await expect(mobileNavigation.getByRole("link", { name: "Pasokan" })).toBeVisible();
    await expect(mobileNavigation.getByRole("link", { name: "Roast" })).toBeVisible();
    await expect(mobileNavigation.getByRole("link", { name: "Kasir" })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2);
    await page.screenshot({
      path: "test-results/dashboard-command-center-mobile.png",
      fullPage: false,
    });

    await page.getByRole("button", { name: "Buka menu" }).click();
    const mobileSidebar = page.locator("aside:visible");
    await expect(mobileSidebar.getByText("Operasional", { exact: true })).toBeVisible();
    await expect(mobileSidebar.getByRole("link", { name: "Pasokan & Stok", exact: true })).toBeVisible();
    await expect(mobileSidebar.getByRole("link", { name: "Produk & Resep", exact: true })).toBeVisible();
    await page.screenshot({
      path: "test-results/dashboard-navigation-mobile.png",
      fullPage: false,
    });
  } finally {
    await prisma.$disconnect();
  }
});
