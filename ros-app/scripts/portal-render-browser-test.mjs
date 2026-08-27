// =============================================================================
// PORTAL RENDER BROWSER TEST — verifies custom-CSS → React inline style
// conversion with REAL computed styles in Chromium. No database, no app
// server: fixture HTML files are produced by the vitest integration test
// (src/features/portal-theme/__tests__/render-integration.test.ts) when
// RENDER_FIXTURES_OUT is set, then loaded via page.setContent.
//
// Usage:
//   pnpm vitest run src/features/portal-theme/__tests__/render-integration.test.ts
//   node scripts/portal-render-browser-test.mjs
// =============================================================================

import { chromium } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const fixtureDir = process.env.RENDER_FIXTURES_OUT
  ?? "C:\\Users\\it.BW\\AppData\\Local\\Temp\\opencode\\render-fixtures";

let failed = 0;
let passed = 0;

function check(name, actual, expected, predicate = (a, b) => a === b) {
  const ok = predicate(actual, expected);
  if (ok) {
    passed++;
    console.log(`  PASS  ${name} → ${JSON.stringify(actual)}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name} → expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function noExecutableMarkup(page, html, { allowAppUrl = false } = {}) {
  check("no <script> in DOM", 0, 0, () => html.includes("<script") === false);
  check("no event-handler attributes", 0, 0, () => !/\son[a-z]+\s*=/.test(html));
  check("no javascript: URLs", 0, 0, () => !html.includes("javascript:"));
  if (!allowAppUrl) {
    check("no url() from tenant", 0, 0, () => !/url\(/.test(html));
  }
}

async function sectionStyle(page) {
  return page.evaluate(() => {
    const el = document.querySelector("#hero-section");
    if (!el) return null;
    return {
      paddingTop: getComputedStyle(el).paddingTop,
      color: getComputedStyle(el).color,
      backgroundColor: getComputedStyle(el).backgroundColor,
      backgroundImage: getComputedStyle(el).backgroundImage,
      boxShadow: getComputedStyle(el).boxShadow,
      transform: getComputedStyle(el).transform,
      filter: getComputedStyle(el).filter,
      transitionDuration: getComputedStyle(el).transitionDuration,
      display: getComputedStyle(el).display,
      gap: getComputedStyle(el).gap,
      gridTemplateColumns: getComputedStyle(el).gridTemplateColumns,
      animationName: getComputedStyle(el).animationName,
      animationIterationCount: getComputedStyle(el).animationIterationCount,
      opacity: getComputedStyle(el).opacity,
    };
  });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const files = readdirSync(fixtureDir).filter((f) => f.endsWith(".html")).sort();

for (const file of files) {
  const name = file.replace(/\.html$/, "");
  console.log(`\n== ${name} ==`);
  const html = readFileSync(resolve(fixtureDir, file), "utf8");
  await page.setContent(html, { waitUntil: "load" });
  noExecutableMarkup(page, html, { allowAppUrl: name === "default-theme" });

  const s = await sectionStyle(page);
  const rootVars = await page.evaluate(() => {
    const root = document.querySelector(".portal-root");
    if (!root) return null;
    return {
      fontHeading: getComputedStyle(root).getPropertyValue("--portal-font-heading").trim(),
      animEasing: getComputedStyle(root).getPropertyValue("--portal-anim-easing").trim(),
    };
  });

  switch (name) {
    case "valid-styles":
      check("color", s?.color, "rgb(255, 0, 0)");
      check("background gradient applied", true, true, () =>
        /linear-gradient\((?:180deg,\s*)?rgb\(255, 0, 0\), rgb\(0, 0, 255\)/.test(s?.backgroundImage ?? ""));
      check("box-shadow applied", true, true, () => (s?.boxShadow ?? "").includes("rgba(0, 0, 0, 0.2)"));
      check("transform rotate applied", true, true, () => (s?.transform ?? "") !== "none");
      check("filter blur applied", s?.filter, "blur(0.5px)");
      check("transition duration", s?.transitionDuration, "0.3s");
      check("display flex", s?.display, "flex");
      check("gap", s?.gap, "8px");
      check("grid has two tracks", true, true, () =>
        (s?.gridTemplateColumns ?? "").split(" ").length === 2 && s.gridTemplateColumns !== "none");
      break;
    case "builtin-precedence":
      check("built-in padding-top wins over custom", s?.paddingTop, "40px");
      check("built-in background-color wins over custom", s?.backgroundColor, "rgb(18, 52, 86)");
      break;
    case "duplicate-last-wins":
      check("last duplicate declaration wins", s?.color, "rgb(0, 0, 255)");
      break;
    case "important-rejected":
      check("!important payload dropped → inherited portal text color", s?.color, "rgb(30, 41, 59)");
      check("!important payload dropped → built-in padding intact", s?.paddingTop, "40px");
      break;
    case "vendor-prefixed-rejected":
      check("vendor-prefixed property rejected → transform none", s?.transform, "none");
      break;
    case "malformed-does-not-crash":
      check("malformed payload dropped, renderer alive", s?.paddingTop, "40px");
      break;
    case "breakout-xss":
      check("breakout payload dropped, renderer alive", s?.paddingTop, "40px");
      check("zero <style> elements in DOM", await page.locator("style").count(), 0);
      break;
    case "entity-encoded":
      check("entity payload inert, renderer alive", s?.paddingTop, "40px");
      break;
    case "url-javascript":
      check("url(javascript:) rejected → no background-image", s?.backgroundImage, "none");
      break;
    case "data-url-html":
      check("data:text/html rejected → no background-image", s?.backgroundImage, "none");
      break;
    case "thousands-of-tokens":
      check("complex payload dropped → built-in padding-left", s?.paddingTop, "40px");
      break;
    case "global-keyframe-reference":
      check("animation-name references global keyframe (allowed)", s?.animationName, "spin");
      check("animation-iteration-count infinite (allowed)", s?.animationIterationCount, "infinite");
      break;
    case "valid-font-and-easing":
      check("heading font custom property", rootVars?.fontHeading, "Plus Jakarta Sans, sans-serif");
      check("global easing custom property", rootVars?.animEasing, "cubic-bezier(0.34, 1.56, 0.64, 1)");
      break;
    case "hide-section-styles":
      check("display none allowed", s?.display, "none");
      check("opacity 0 allowed", s?.opacity, "0");
      break;
    case "default-theme":
      check("no <script> in default theme", 0, 0, () => !html.includes("<script"));
      check("app-authored marquee keyframes style tag present", true, true, () =>
        html.includes("@keyframes marquee"));
      break;
    default:
      console.log("  (no case-specific checks)");
  }
}

await browser.close();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
