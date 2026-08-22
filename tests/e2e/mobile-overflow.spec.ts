import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { sealData } from "iron-session";

import { SESSION_OPTIONS } from "../../src/lib/session";
import { getTenantAccessState } from "../../src/lib/subscription";

const MOBILE_VIEWPORT = { width: 360, height: 800 };

const PAGES_TO_TEST = [
  { path: "/dashboard", name: "Dashboard" },
  { path: "/inventory", name: "Inventory" },
  { path: "/roasting", name: "Roasting" },
  { path: "/produksi", name: "Produksi" },
  { path: "/penjualan", name: "Penjualan" },
  { path: "/keuangan", name: "Keuangan" },
  { path: "/kasir", name: "Kasir" },
  { path: "/katalog", name: "Katalog" },
  { path: "/laporan", name: "Laporan" },
  { path: "/master-data", name: "Master Data" },
  { path: "/audit", name: "Audit" },
  { path: "/settings", name: "Settings" },
];

test.describe("Mobile overflow check (360x800)", () => {
  test.skip(!process.env.DATABASE_URL, "DATABASE_URL is required.");

  let sessionCookie: string;

  test.beforeAll(async () => {
    const prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    });

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
      (candidate) => getTenantAccessState(candidate.tenant) === "ACTIVE"
    );

    if (!owner) {
      await prisma.$disconnect();
      return;
    }

    const { tenant: _tenant, ...user } = owner;
    sessionCookie = await sealData(
      { user },
      {
        password: SESSION_OPTIONS.password,
        ttl: SESSION_OPTIONS.cookieOptions.maxAge,
      }
    );

    await prisma.$disconnect();
  });

  for (const { path, name } of PAGES_TO_TEST) {
    test(`${name} (${path}) — no horizontal overflow at 360px`, async ({
      context,
      page,
    }) => {
      test.skip(!sessionCookie, "No owner session available.");

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

      await page.setViewportSize(MOBILE_VIEWPORT);
      await page.goto(path, { waitUntil: "networkidle" });

      // Wait for any animations/transitions to settle
      await page.waitForTimeout(500);

      // Check no horizontal overflow on the document
      const overflow = await page.evaluate(() => {
        const docWidth = document.documentElement.scrollWidth;
        const viewWidth = window.innerWidth;
        return { docWidth, viewWidth, overflow: docWidth > viewWidth };
      });

      expect(
        overflow.overflow,
        `${name}: scrollWidth (${overflow.docWidth}) > innerWidth (${overflow.viewWidth})`
      ).toBe(false);

      // Check no body overflow
      const bodyOverflow = await page.evaluate(() => {
        const body = document.body;
        const bodyWidth = body.scrollWidth;
        const viewWidth = window.innerWidth;
        return { bodyWidth, viewWidth, overflow: bodyWidth > viewWidth };
      });

      expect(
        bodyOverflow.overflow,
        `${name}: body scrollWidth (${bodyOverflow.bodyWidth}) > innerWidth (${bodyOverflow.viewWidth})`
      ).toBe(false);
    });
  }

  // Special test: FAB doesn't cover last item
  test("Inventory — FAB does not cover last list item", async ({
    context,
    page,
  }) => {
    test.skip(!sessionCookie, "No owner session available.");

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

    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/inventory", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    // Find the FAB button
    const fab = page.locator('button[aria-label="Buka menu aksi"]');
    const fabVisible = await fab.isVisible().catch(() => false);

    if (fabVisible) {
      const fabBox = await fab.boundingBox();
      expect(fabBox).not.toBeNull();

      // Scroll to bottom
      await page.evaluate(() => {
        const scrollable = document.querySelector(".custom-scrollbar");
        if (scrollable) scrollable.scrollTop = scrollable.scrollHeight;
      });
      await page.waitForTimeout(300);

      // Check that the content area has enough bottom padding for FAB clearance
      // Target the main content area (has both overflow-auto and p-4 classes)
      const paddingInfo = await page.evaluate(() => {
        const candidates = document.querySelectorAll(".custom-scrollbar");
        let scrollable: Element | null = null;
        for (const el of candidates) {
          // The content area has overflow-auto and p-4, not overflow-y-auto with py-2
          if (el.classList.contains("overflow-auto") && el.classList.contains("p-4")) {
            scrollable = el;
            break;
          }
        }
        if (!scrollable) return { found: false, paddingBottom: "0px", className: "" };
        const style = window.getComputedStyle(scrollable);
        return {
          found: true,
          paddingBottom: style.paddingBottom,
          className: scrollable.className,
        };
      });

      if (paddingInfo.found) {
        const pbValue = parseInt(paddingInfo.paddingBottom, 10);
        expect(
          pbValue,
          `Expected bottom padding >= 80px, got ${pbValue}px. Classes: ${paddingInfo.className}`
        ).toBeGreaterThanOrEqual(80);
      }
    }
  });
});
