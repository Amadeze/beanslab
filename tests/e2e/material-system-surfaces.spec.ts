import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { sealData } from "iron-session";

import { SESSION_OPTIONS } from "../../src/lib/session";

test("public and account surfaces share the material system", async ({ page }) => {
  const routes = [
    { path: "/login", heading: "Kembali ke alur operasi" },
    { path: "/register", heading: "Mulai dari struktur yang benar" },
    { path: "/forgot-password", heading: "Kembali ke ruang kendali" },
    { path: "/reset-password?token=visual-check", heading: "Tetapkan kunci akses baru" },
  ];

  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const route of routes) {
    await page.goto(route.path, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: route.heading, exact: false })).toBeVisible();
  }

  await page.goto("/login", { waitUntil: "networkidle" });
  await page.screenshot({
    path: "test-results/material-login-desktop.png",
    fullPage: false,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/register", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Mulai dari struktur yang benar", exact: false })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
  await page.screenshot({
    path: "test-results/material-register-mobile.png",
    fullPage: false,
  });
});

test("login and register share the command-dossier motion language", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/login", { waitUntil: "networkidle" });
  await expect(page.getByTestId("auth-ambient-scan")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kembali ke alur operasi", exact: false })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/register", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Mulai dari struktur yang benar", exact: false })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByTestId("auth-ambient-scan")).toHaveCount(0);
});

test("landing opens with the live roast trace on desktop and mobile", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: /Roasting selesai/ })).toBeVisible();
  await expect(page.getByText("Roastd Studio · Live", { exact: true })).toBeVisible();
  await expect(page.getByText("Profile match", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/material-landing-desktop.png",
    fullPage: false,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: /Roasting selesai/ })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
  await page.screenshot({
    path: "test-results/material-landing-mobile.png",
    fullPage: false,
  });
});

test("landing motion communicates flow and respects reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/", { waitUntil: "networkidle" });

  const tableau = page.getByTestId("landing-tableau");
  await expect(tableau).toBeVisible();
  await page.waitForTimeout(800);
  const neutralTransform = await tableau.evaluate((element) => getComputedStyle(element).transform);
  const box = await tableau.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width * 0.82, box!.y + box!.height * 0.2);
  await page.waitForTimeout(250);
  const tiltedTransform = await tableau.evaluate((element) => getComputedStyle(element).transform);
  expect(tiltedTransform).not.toBe(neutralTransform);

  await page.getByText("Artisan roast telemetry", { exact: true }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  await expect(page.getByTestId("roast-curve-primary")).toBeVisible();
  await page.getByRole("button", { name: "Apakah roastd.id menggantikan Artisan?" }).scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Apakah roastd.id menggantikan Artisan?" }).click();
  await expect(page.getByText(/Artisan tetap menjadi alat kerja roasting/)).toBeVisible();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByTestId("landing-ambient-scan")).toHaveCount(0);
});

test("superadmin control plane uses the same material language", async ({ context, page }) => {
  test.setTimeout(120_000);
  test.skip(!process.env.DATABASE_URL, "DATABASE_URL is required for superadmin visual checks.");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  try {
    const superadmin = await prisma.user.findFirst({
      where: { role: "SUPERADMIN", isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        tenantId: true,
      },
    });
    test.skip(!superadmin, "An active superadmin is required.");
    const targetTenant = await prisma.tenant.findFirst({
      where: { id: { not: "default" } },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
    });

    const sessionCookie = await sealData(
      { user: superadmin! },
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
    await page.goto("/superadmin/dashboard", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await expect(page.getByRole("heading", { name: "Kendalikan platform, bukan tabel.", exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Platform pulse", { exact: true })).toBeVisible();
    await page.screenshot({
      path: "test-results/material-superadmin-desktop.png",
      fullPage: false,
    });

    await page.goto("/superadmin/subscriptions", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await expect(page.getByRole("heading", { name: "Subscription & pembayaran", exact: true })).toBeVisible({ timeout: 60_000 });
    await page.screenshot({ path: "test-results/material-superadmin-subscriptions.png", fullPage: false });
    await page.goto("/superadmin/incidents", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await expect(page.getByRole("heading", { name: "Incident center", exact: true })).toBeVisible({ timeout: 60_000 });
    await page.screenshot({ path: "test-results/material-superadmin-incidents.png", fullPage: false });
    await page.goto("/superadmin/studio", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await expect(page.getByRole("heading", { name: "Studio fleet", exact: true })).toBeVisible({ timeout: 60_000 });
    await page.screenshot({ path: "test-results/material-superadmin-studio.png", fullPage: false });
    if (targetTenant) {
      await page.goto(`/superadmin/tenants/${targetTenant.id}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await expect(page.getByRole("heading", { name: targetTenant.name, exact: true })).toBeVisible({ timeout: 60_000 });
      await page.screenshot({ path: "test-results/material-superadmin-tenant-360.png", fullPage: false });
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/superadmin/dashboard", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await expect(page.getByRole("heading", { name: "Kendalikan platform, bukan tabel.", exact: true })).toBeVisible({ timeout: 60_000 });
    const dashboardOverflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(dashboardOverflows).toBe(false);
    await page.screenshot({
      path: "test-results/material-superadmin-mobile.png",
      fullPage: false,
    });

    await page.goto("/superadmin/tenants", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await expect(page.getByRole("heading", { name: "Tenant registry", exact: true })).toBeVisible({ timeout: 60_000 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(2);
    await page.screenshot({
      path: "test-results/material-superadmin-tenants-mobile.png",
      fullPage: false,
    });
  } finally {
    await prisma.$disconnect();
  }
});
