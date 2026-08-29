import { expect, test, type Page } from "@playwright/test";

/**
 * Visual regression for public surfaces.
 *
 * Baselines are stored next to this spec (tests/e2e/visual-regression/__screenshots__).
 * To (re)capture baselines after an intentional design change, run:
 *   pnpm exec playwright test tests/e2e/visual-regression --update-snapshots
 *
 * Tuning:
 *  - `maxDiffPixelRatio` absorbs anti-aliasing/subpixel drift while still failing
 *    on real layout, token, or content regressions.
 *  - Animation is disabled via `reducedMotion: "reduce"` so motion never causes
 *    false diffs. Grab the static "final" state that the design system mandates.
 */

test.describe.configure({ mode: "serial" });

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
] as const;

const PUBLIC_SURFACES: Array<{
  path: string;
  key: string;
  ready?: (page: Page) => Promise<void>;
}> = [
  { path: "/", key: "landing" },
  { path: "/login", key: "login" },
  { path: "/register", key: "register" },
  { path: "/forgot-password", key: "forgot-password" },
  { path: "/reset-password?token=visual-check", key: "reset-password" },
];

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.name}`, () => {
    for (const surface of PUBLIC_SURFACES) {
      test(`visual: ${surface.key} @${viewport.name}`, async ({ page }) => {
        test.setTimeout(90_000);

        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        // Reduced motion gives us a deterministic, static render for comparison.
        await page.emulateMedia({ reducedMotion: "reduce" });

        await page.goto(surface.path, { waitUntil: "networkidle" });

        // Wait for route-level ready hooks if provided (e.g. heading appears).
        if (surface.ready) {
          await surface.ready(page);
        }

        // Mobile-only: assert no horizontal overflow on public surfaces.
        if (viewport.name === "mobile") {
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          );
          expect(overflow).toBeLessThanOrEqual(2);
        }

        await expect(page).toHaveScreenshot(`${surface.key}-${viewport.name}.png`, {
          maxDiffPixelRatio: 0.02,
          animations: "disabled",
          caret: "hide",
        });
      });
    }
  });
}
