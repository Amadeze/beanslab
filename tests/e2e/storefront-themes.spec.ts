import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const THEMES = [
  "heritage",
  "neomodern",
  "cyber",
  "botanical",
  "editorial",
  "liquid",
  "industrial",
  "club",
  "luxury",
  "playful",
] as const;

test("all tenant storefront themes render settings, content, and cart responsively", async ({ page }) => {
  test.setTimeout(480_000);
  test.skip(!process.env.DATABASE_URL, "DATABASE_URL is required for storefront theme tests.");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const tenantIds: string[] = [];
  const consoleErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  try {
    for (const layoutStyle of THEMES) {
      const tenantId = `e2e-theme-${layoutStyle}-${suffix}`;
      const subdomain = `e2e-${layoutStyle}-${suffix}`;
      tenantIds.push(tenantId);

      await prisma.tenant.create({
        data: {
          id: tenantId,
          code: `THEME-${layoutStyle}-${suffix}`,
          name: `${layoutStyle} Roastery`,
          subdomain,
          subscriptionTier: "PRO",
          subscriptionStatus: "ACTIVE",
          layoutStyle,
          themeColor: "blue",
          fontFamily: "mono",
          themeMode: ["cyber", "liquid", "industrial", "luxury"].includes(layoutStyle)
            ? "dark"
            : "light",
          borderRadius: "xl",
          animationStyle: "fast",
          animationDirection: "left",
          iconStyle: "duotone",
          logoUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          heroImageUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAQAAABFaP0WAAAADUlEQVR42mP8z8BQDwAEhQGAH9kXjwAAAABJRU5ErkJggg==",
          heroText: `Hero ${layoutStyle}`,
          aboutText: `About ${layoutStyle}`,
          problemStatement: `Problem ${layoutStyle}`,
          solutionStatement: `Solution ${layoutStyle}`,
          uspText: `USP ${layoutStyle}`,
          catalogTitle: `Catalog ${layoutStyle}`,
          catalogSubtitle: `Subtitle ${layoutStyle}`,
          footerText: `Footer ${layoutStyle}`,
          features: [{ title: "Traceable", desc: "Every batch is documented.", iconName: "Shield" }],
          testimonials: [{ name: "Cafe Partner", role: "Owner", text: "Reliable coffee.", rating: 5 }],
          faqs: [{ question: "Can I order wholesale?", answer: "Yes, directly from this catalog." }],
        },
      });
      await prisma.product.create({
        data: {
          code: `FG-${layoutStyle}-${suffix}`,
          name: `Coffee ${layoutStyle}`,
          type: "FINISHED_GOODS",
          price: 75_000,
          stockKg: 10,
          stockUnit: 20,
          tenantId,
        },
      });

      await page.setViewportSize({ width: 1280, height: 800 });
      const response = await page.goto(`/tenant/${subdomain}`, { waitUntil: "domcontentloaded" });
      expect(response?.status(), layoutStyle).toBe(200);
      await expect(page.getByText(`Hero ${layoutStyle}`, { exact: false }).first()).toBeVisible();
      await expect(page.getByText(`Catalog ${layoutStyle}`, { exact: false }).first()).toBeAttached();
      await expect(page.locator("header").first()).toBeVisible();

      const themeWrapper = page.locator(".t-root");
      await expect(themeWrapper).toHaveAttribute("data-animation", "fast");
      await expect(themeWrapper).toHaveAttribute("data-animation-direction", "left");
      expect(await themeWrapper.evaluate((element) =>
        getComputedStyle(element).getPropertyValue("--t-primary").trim()
      )).toBe("#3b82f6");
      expect(await themeWrapper.evaluate((element) =>
        getComputedStyle(element).getPropertyValue("--t-radius").trim()
      )).toBe("12px");
      expect(await themeWrapper.evaluate((element) =>
        getComputedStyle(element).getPropertyValue("--t-font-body").trim()
      )).toContain("JetBrains Mono");

      await page.locator("#catalog").scrollIntoViewIfNeeded();
      await expect(page.getByText(`Coffee ${layoutStyle}`, { exact: false }).first()).toBeVisible();
      await page.getByText(`Coffee ${layoutStyle}`, { exact: false }).first().scrollIntoViewIfNeeded();

      const addButton = page.getByRole("button", { name: `Add Coffee ${layoutStyle} to cart` });
      await addButton.click({ force: true });
      await expect(page.getByRole("heading", { name: "Your Cart" })).toBeVisible();
      await page.getByRole("button", { name: "Tutup keranjang" }).click();
      const cartButton = page.getByRole("button", { name: /cart/i }).first();
      await expect(cartButton).toContainText("1");

      await page.setViewportSize({ width: 390, height: 844 });
      await page.reload({ waitUntil: "domcontentloaded" });
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, `${layoutStyle} horizontal overflow`).toBeLessThanOrEqual(2);
      await expect(page.getByRole("button", { name: /cart/i }).first()).toBeVisible();
    }

    expect(consoleErrors).toEqual([]);
  } finally {
    await prisma.product.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await prisma.$disconnect();
  }
});
