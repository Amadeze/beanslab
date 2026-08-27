import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const EMAIL = "bugtest@example.com";
const PASS = "Test1234!";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log("PAGE>", m.type(), m.text()); });
  page.on("pageerror", (e) => console.log("PAGEERR>", e.message));

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard**", { timeout: 15000 }).catch(() => {});
  console.log("AFTER LOGIN URL:", page.url());

  await page.goto(`${BASE}/settings/commerce`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[name="flatShippingRate"]', { timeout: 20000 });
  console.log("COMMERCE URL:", page.url());

  const sel = 'input[name="flatShippingRate"]';
  const before = await page.inputValue(sel);
  console.log("flatShippingRate BEFORE:", JSON.stringify(before));
  const newValue = before === "99999" ? "11111" : "99999";
  await page.fill(sel, newValue);
  console.log("SET TO:", newValue);

  await page.click('button:has-text("Simpan pengaturan")');
  await page.waitForTimeout(3000);

  const after = await page.inputValue(sel);
  console.log("flatShippingRate AFTER (input):", JSON.stringify(after), "MATCH:", after === newValue);

  await browser.close();
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
