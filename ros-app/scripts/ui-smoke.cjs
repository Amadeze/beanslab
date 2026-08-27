const { chromium } = require("@playwright/test");
const path = require("node:path");
const fs = require("node:fs");
const dotenv = require("dotenv");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { sealData } = require("iron-session");

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const baseUrl = process.env.UI_TEST_BASE_URL || "http://localhost:3000";
const outputDir = process.env.UI_TEST_OUTPUT || path.join(process.cwd(), "test-results", "ui-smoke");
let browser;

async function installLocalTestSession(context) {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL || "" }),
  });
  try {
    const user = await prisma.user.findUnique({
      where: { email: process.env.UI_TEST_EMAIL || "system@ros.internal" },
      select: { id: true, name: true, email: true, role: true, tenantId: true },
    });
    if (!user || !process.env.SESSION_SECRET) throw new Error("Akun atau SESSION_SECRET untuk smoke test tidak tersedia.");
    const value = await sealData({ user }, { password: process.env.SESSION_SECRET, ttl: 60 * 60 });
    await context.addCookies([{ name: "ros_session", value, url: baseUrl, httpOnly: true, sameSite: "Strict" }]);
  } finally {
    await prisma.$disconnect();
  }
}

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    const text = message.text();
    const knownHeadlessCaretMismatch = text.includes("hydrated but some attributes") && text.includes("caret-color");
    if (message.type() === "error" && !knownHeadlessCaretMismatch) errors.push(`console: ${text}`);
  });

  await installLocalTestSession(page.context());

  for (const route of ["/cupping", "/inventory/lots", "/ai-insights", "/settings/notifications"]) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
    if (page.url().includes("/login")) throw new Error(`Login hilang saat membuka ${route}`);
    await page.locator("h1").first().waitFor({ timeout: 20_000 });
    const heading = await page.locator("h1").first().textContent();
    if (!heading?.trim()) throw new Error(`Heading tidak ditemukan pada ${route}`);
    const filename = route.replace(/^\//, "").replaceAll("/", "-") || "home";
    await page.screenshot({ path: path.join(outputDir, `${filename}.png`), fullPage: true });
    console.log(`${route}: ${heading.trim()}`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/cupping`, { waitUntil: "domcontentloaded" });
  await page.locator("h1").first().waitFor({ timeout: 20_000 });
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  if (hasHorizontalOverflow) throw new Error("Cupping mobile memiliki horizontal overflow.");
  await page.screenshot({ path: path.join(outputDir, "cupping-mobile.png"), fullPage: true });
  console.log("/cupping: mobile 390px tanpa horizontal overflow");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${baseUrl}/cupping`, { waitUntil: "domcontentloaded" });
  await page.locator('input[type="range"]').first().fill("8.5");
  await page.getByRole("button", { name: "Floral" }).click();
  const sliderValue = await page.locator('input[type="range"]').first().inputValue();
  if (Number(sliderValue) !== 8.5) {
    throw new Error(`Slider cupping tidak memperbarui skor (nilai ${sliderValue}).`);
  }
  if ((await page.getByRole("button", { name: "Floral" }).getAttribute("aria-pressed")) !== "true") {
    throw new Error("Descriptor cupping tidak dapat dipilih.");
  }
  await page.screenshot({ path: path.join(outputDir, "cupping-interactive.png"), fullPage: true });
  console.log("/cupping: slider dan descriptor memperbarui profil interaktif");

  await page.goto(`${baseUrl}/inventory`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) throw new Error("Login hilang saat membuka /inventory");
  await page.getByRole("button", { name: "Barang Datang" }).first().click();
  const legacyGreenBeanChoice = page.getByRole("button", { name: /Green Bean \(GB\)/ });
  if (await legacyGreenBeanChoice.isVisible().catch(() => false)) {
    await legacyGreenBeanChoice.click();
  }
  const shippingInput = page.locator('input[name="shippingCost"]');
  await shippingInput.waitFor({ state: "visible", timeout: 20_000 });
  if (await shippingInput.inputValue() !== "0") throw new Error("Nilai awal ongkir bukan 0.");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outputDir, "inventory-purchase-modal.png"), fullPage: true });
  console.log("/inventory: kolom ongkir opsional terlihat");

  await page.goto(`${baseUrl}/inventory?view=po`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Buat PO" }).first().click();
  await page.locator('input[name="estimatedShippingCost"]').waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outputDir, "inventory-po-shipping.png"), fullPage: true });
  console.log("/inventory?view=po: estimasi ongkir terlihat");

  await page.goto(`${baseUrl}/inventory?view=receiving`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Catat Penerimaan" }).first().click();
  await page.getByText("Ambil dari Purchase Order").waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForFunction(() => !document.body.innerText.includes("Memuat PO..."), null, { timeout: 20_000 });
  const receivePoSelect = page.getByRole("combobox").last();
  await receivePoSelect.click();
  const firstPoOption = page.getByRole("option").first();
  if (await firstPoOption.count()) {
    await firstPoOption.click();
    await page.getByText("Quantity Diterima").waitFor({ state: "visible", timeout: 20_000 });
    if ((await receivePoSelect.textContent())?.includes("cms")) throw new Error("Pemilih penerimaan masih menampilkan ID database.");
    await page.getByRole("button", { name: "Transfer" }).click();
    await page.getByText("Dicatat lunas melalui transfer bank.").waitFor({ state: "visible" });
    const excludeItemButton = page.getByRole("button", { name: /Tidak terima/ }).last();
    await excludeItemButton.click();
    await page.getByText("Tidak diterima sekarang", { exact: true }).waitFor({ state: "visible" });
    await page.waitForTimeout(1000);
    await page.getByText(/Total diterima/).waitFor({ state: "visible" });
  }
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outputDir, "inventory-quick-receiving.png"), fullPage: true });
  console.log("/inventory?view=receiving: penarikan PO langsung tersedia");

  const tenant = process.env.UI_TEST_TENANT || "test-roastery";
  const base = new URL(baseUrl);
  const tenantUrl = base.hostname === "localhost" || base.hostname === "127.0.0.1"
    ? `${base.protocol}//${tenant}.localhost${base.port ? `:${base.port}` : ""}`
    : `https://${tenant}.${process.env.NEXT_PUBLIC_TENANT_ROOT_DOMAIN || "roastd.id"}`;
  await page.goto(tenantUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.locator("body").waitFor();
  if (page.url().includes("/tenant/")) throw new Error("Storefront mengekspos path internal /tenant/.");
  await page.screenshot({ path: path.join(outputDir, "tenant-subdomain.png"), fullPage: true });
  console.log(`${tenantUrl}: ${await page.title()}`);

  await browser.close();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  }
})().catch(async (error) => {
  console.error(error);
  if (browser) await browser.close();
  process.exitCode = 1;
});
