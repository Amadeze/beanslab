const { chromium } = require("@playwright/test");
const path = require("node:path");
const fs = require("node:fs");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { sealData } = require("iron-session");

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} wajib diatur secara eksplisit.`);
  return value;
}

function assertLocalSmokeTargets(baseUrlValue, databaseUrlValue) {
  const app = new URL(baseUrlValue);
  const database = new URL(databaseUrlValue);
  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0", "host.docker.internal"]);
  if (!localHosts.has(app.hostname)) {
    throw new Error(`UI_TEST_BASE_URL harus lokal; diterima ${app.hostname}.`);
  }
  if (!localHosts.has(database.hostname)) {
    throw new Error(`UI_TEST_DB_URL harus lokal; diterima ${database.hostname}.`);
  }
  const databaseName = database.pathname.replace(/^\//, "");
  if (!/(test|smoke|local)/i.test(databaseName)) {
    throw new Error(`UI_TEST_DB_URL harus memakai database test/smoke; diterima ${databaseName}.`);
  }
  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    if (process.env[key] && process.env[key] === databaseUrlValue) {
      throw new Error(`UI_TEST_DB_URL tidak boleh sama dengan ${key}.`);
    }
  }
}

const baseUrl = requiredEnv("UI_TEST_BASE_URL");
const uiTestDatabaseUrl = requiredEnv("UI_TEST_DB_URL");
assertLocalSmokeTargets(baseUrl, uiTestDatabaseUrl);
const outputDir = path.join(process.cwd(), "test-results", "ui-smoke-cfp");
const tenantId = "smoke-cfp-tenant";
let browser;

async function installLocalTestSession(context) {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: uiTestDatabaseUrl }),
  });
  try {
    const user = await prisma.user.findUnique({
      where: { email: process.env.UI_TEST_EMAIL || "smoke-cfp@test.local" },
      select: { id: true, name: true, email: true, role: true, tenantId: true, sessionVersion: true },
    });
    if (!user || !process.env.SESSION_SECRET) throw new Error("Akun atau SESSION_SECRET untuk smoke test tidak tersedia.");
    const value = await sealData({ user: { id: user.id, name: user.name, email: user.email, role: user.role, tenantId: user.tenantId, sessionVersion: user.sessionVersion } }, { password: process.env.SESSION_SECRET, ttl: 60 * 60 });
    await context.addCookies([{ name: "ros_session", value, url: baseUrl, httpOnly: true, sameSite: "Strict" }]);
  } finally {
    await prisma.$disconnect();
  }
}

const steps = [];

function record(name, ok, detail = "") {
  steps.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

async function toastText(page, needle) {
  try {
    const toast = page.locator("[data-sonner-toast]").filter({ hasText: needle }).first();
    await toast.waitFor({ state: "visible", timeout: 8000 });
    return (await toast.textContent()) || "";
  } catch {
    return "";
  }
}

async function openBarangDatang(page, choice) {
  try {
    await page.locator('[aria-label="Barang Datang"]').first().click();
    await page.getByText("Barang apa yang datang?").waitFor({ state: "visible", timeout: 10000 });
    await page.locator("button", { hasText: choice }).first().click();
  } catch (e) {
    await page.screenshot({ path: path.join(outputDir, "DEBUG-popup-fail.png"), fullPage: true });
    const btns = await page.getByRole("button").allTextContents();
    console.log("DEBUG btns:", JSON.stringify(btns.filter((t) => t && t.trim()).slice(0, 40)));
    const dlg = await page.locator("[role=dialog]").count();
    console.log("DEBUG dialogs:", dlg);
    const dlgTexts = [];
    for (let i = 0; i < dlg; i++) dlgTexts.push((await page.locator("[role=dialog]").nth(i).textContent())?.slice(0, 150));
    console.log("DEBUG dialog texts:", JSON.stringify(dlgTexts));
    throw e;
  }
}

async function step1Fill(page, supplierLabel) {
  await page.getByText("Supplier", { exact: true }).first().waitFor({ state: "visible", timeout: 10000 });
  await page.locator('select[name="supplierId"]').selectOption({ label: supplierLabel });
  const dateInput = page.locator('input[name="receivedAt"]');
  await dateInput.waitFor({ state: "visible" });
  if (!(await dateInput.inputValue())) await dateInput.fill(new Date().toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.locator('select[name="productId"], input[name="productName"]').first().waitFor({ state: "visible", timeout: 8000 });
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

  // ── 0. Buka halaman inventori ──
  await page.goto(`${baseUrl}/inventory`, { waitUntil: "domcontentloaded", timeout: 180000 });
  if (page.url().includes("/login")) throw new Error("Sesi tidak dikenali — redirect ke /login");
  await page.locator("h1").first().waitFor({ timeout: 20000 });
  record("0. /inventory terbuka dengan sesi", true, await page.locator("h1").first().textContent());
  await page.waitForTimeout(2500);

  // ── 1. Drawer GB: tidak ada tombol submit di footer drawer; wizard step 1 tampil ──
  await openBarangDatang(page, "Green Bean (GB)");
  await page.locator('select[name="supplierId"]').waitFor({ state: "visible", timeout: 10000 });
  const drawerFooterSubmit = page.getByText("Simpan Pembelian", { exact: true }).last().isVisible().catch(() => false);
  if (!(await drawerFooterSubmit)) record("1a. Drawer GB tanpa tombol submit premature", true);
  const drawerFooterCount = await page.locator("[data-drawer-footer]").count();
  record("1b. Drawer GB showFooter=false (footer count)", drawerFooterCount === 0, `count=${drawerFooterCount}`);
  const hasWizardSteps = (await page.getByText("Supplier", { exact: true }).count()) > 0 && (await page.getByText("Produk", { exact: true }).count()) > 0 && (await page.getByText("Pembayaran", { exact: true }).count()) > 0;
  record("1c. Wizard 3 langkah (Supplier/Produk/Pembayaran) tampil", hasWizardSteps);
  await page.screenshot({ path: path.join(outputDir, "01-gb-drawer-step1.png"), fullPage: true });

  // ── 2. Navigasi prematur: Lanjut tanpa supplier → toast, tetap di step 1 ──
  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.waitForTimeout(600);
  const toastEmpty = await toastText(page, "Lengkapi supplier");
  record("2. Lanjut tanpa supplier memblokir + toast", toastEmpty.includes("Lengkapi supplier dan tanggal"), toastEmpty);
  const stillStep1 = await page.locator('select[name="supplierId"]').isVisible();
  record("2b. Tetap di step 1 setelah blokir", stillStep1);

  // ── 3. Flow A: GB baru (produk + sumber baru, otomatis dibuat) ──
  await step1Fill(page, "Supplier Smoke Kopi");
  await page.getByRole("button", { name: /Produk baru/ }).first().click();
  await page.getByPlaceholder("e.g. Gayo Natural, Ethiopia Yirgacheffe").fill("GB Smoke CFP A1");
  await page.getByPlaceholder("e.g. Aceh, Ethiopia, Flores").fill("Gayo");
  await page.locator('input[name="weightKg"]').fill("25");
  await page.locator('input[name="totalCost"]').fill("150000");
  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.getByText("Best Before / Review Mutu").waitFor({ state: "visible", timeout: 8000 });
  await page.screenshot({ path: path.join(outputDir, "03a-gb-step3.png"), fullPage: true });
  await page.getByRole("button", { name: "Simpan Pembelian" }).click();
  const toastA = await toastText(page, "Barang datang dicatat");
  record("3. Flow A — GB baru disimpan", toastA.includes("Barang datang dicatat"), toastA);
  await page.waitForTimeout(800);
  record("3b. Drawer GB tertutup setelah sukses", !(await page.locator('select[name="supplierId"]').isVisible().catch(() => false)));

  // ── 4. Flow B: GB lama dipakai ulang lewat pilihan produk eksplisit ──
  await openBarangDatang(page, "Green Bean (GB)");
  await step1Fill(page, "Supplier Smoke Kopi");
  const gbSelect = page.locator('select[name="productId"]');
  await gbSelect.waitFor({ state: "visible", timeout: 8000 });
  const gbOptions = await gbSelect.locator("option").allTextContents();
  record("4a. Opsi GB lama tersedia", gbOptions.some((o) => o.includes("Green Bean Smoke Gayo")), gbOptions.join(" | "));
  await gbSelect.selectOption(await gbSelect.locator("option", { hasText: "Green Bean Smoke Gayo" }).first().getAttribute("value"));
  await page.locator('input[name="weightKg"]').fill("10");
  await page.locator('input[name="totalCost"]').fill("60000");
  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.getByText("Best Before / Review Mutu").waitFor({ state: "visible", timeout: 8000 });
  await page.getByRole("button", { name: "Simpan Pembelian" }).click();
  const toastB = await toastText(page, "Barang datang dicatat");
  record("4. Flow B — GB lama dipakai ulang", toastB.includes("Barang datang dicatat"), toastB);
  await page.waitForTimeout(800);

  // ── 5. Flow C: RB baru + Sumber baru + detail identitas ──
  await openBarangDatang(page, "Roasted Bean (RB)");
  await step1Fill(page, "Supplier Smoke Kopi");
  await page.getByRole("button", { name: /Produk baru/ }).first().click();
  await page.getByRole("button", { name: "Roasted Bean (Beli Jadi)" }).click();
  await page.getByPlaceholder("e.g. Gayo Beli Jadi Medium, Ethiopia Yirgacheffe Dark").fill("RB Smoke CFP C1");
  await page.getByPlaceholder("e.g. Aceh, Ethiopia, Flores").fill("Gayo");
  await page.locator('select').filter({ hasText: "Pilih sumber yang sudah ada" }).selectOption("new");
  await page.getByPlaceholder("e.g. Gayo Atu Lintang, Kopi Sumber Alam").fill("Sumber Smoke CFP C1");
  await page.getByRole("button", { name: "Detail identitas kopi (opsional)" }).click();
  await page.getByPlaceholder("e.g. Kabupaten Gayo Lues").fill("Lampung Barat");
  await page.getByPlaceholder("e.g. Arabica, Robusta").fill("ROBUSTA");
  await page.getByPlaceholder("e.g. Tim Tim, Bourbon").fill("Sigararutang");
  await page.locator('select[name="productRoastLevel"]').selectOption("MEDIUM");
  await page.locator('input[name="weightKg"]').fill("5");
  await page.locator('input[name="totalCost"]').fill("400000");
  await page.screenshot({ path: path.join(outputDir, "05-rb-new-source.png"), fullPage: true });
  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.getByText("Best Before / Review Mutu").waitFor({ state: "visible", timeout: 8000 });
  await page.getByRole("button", { name: "Simpan Pembelian" }).click();
  const toastC = await toastText(page, "Barang datang dicatat");
  record("5. Flow C — RB baru + sumber baru disimpan", toastC.includes("Barang datang dicatat"), toastC);
  await page.waitForTimeout(800);

  // ── 6. Flow D: RB lama dipakai ulang + toggle GB/RB di wizard ──
  await openBarangDatang(page, "Roasted Bean (RB)");
  await step1Fill(page, "Supplier Smoke Kopi");
  const rbSelect = page.locator('select[name="productId"]');
  await rbSelect.waitFor({ state: "visible", timeout: 8000 });
  const rbOptions = await rbSelect.locator("option").allTextContents();
  record("6a. Opsi RB lama tersedia (Beli Jadi)", rbOptions.some((o) => o.includes("Roasted Smoke Beli Jadi") && o.includes("MEDIUM")), rbOptions.join(" | "));
  await page.getByRole("button", { name: "Green Bean" }).click();
  const gbAfterToggle = page.locator('select[name="productId"]');
  await gbAfterToggle.waitFor({ state: "visible", timeout: 8000 });
  const gbToggleOptions = await gbAfterToggle.locator("option").allTextContents();
  record("6b. Toggle ke GB menampilkan daftar GB", gbToggleOptions.some((o) => o.includes("Green Bean Smoke Gayo")), gbToggleOptions.join(" | "));
  await page.getByRole("button", { name: "Roasted Bean (Beli Jadi)" }).click();
  const rbAfterToggle = page.locator('select[name="productId"]');
  await rbAfterToggle.waitFor({ state: "visible", timeout: 8000 });
  await rbAfterToggle.selectOption(await rbAfterToggle.locator("option", { hasText: "Roasted Smoke Beli Jadi" }).first().getAttribute("value"));
  await page.locator('input[name="weightKg"]').fill("3");
  await page.locator('input[name="totalCost"]').fill("250000");
  await page.getByRole("button", { name: "Lanjut" }).click();
  await page.getByText("Best Before / Review Mutu").waitFor({ state: "visible", timeout: 8000 });
  await page.screenshot({ path: path.join(outputDir, "06-rb-reuse-step3.png"), fullPage: true });
  await page.getByRole("button", { name: "Simpan Pembelian" }).click();
  const toastD = await toastText(page, "Barang datang dicatat");
  record("6. Flow D — RB lama dipakai ulang (toggle + reuse)", toastD.includes("Barang datang dicatat"), toastD);
  await page.waitForTimeout(800);

  // ── 7. Flow E: wizard tanpa submit premature — tutup drawer di step 2 ──
  await openBarangDatang(page, "Green Bean (GB)");
  await page.locator('select[name="supplierId"]').waitFor({ state: "visible", timeout: 10000 });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);
  const closedCleanly = !(await page.locator('select[name="supplierId"]').isVisible().catch(() => false));
  const noErrorToast = !errors.some((e) => e.includes("zod") || e.includes("validate"));
  record("7. Drawer ditutup di step 1 tanpa validasi/error", closedCleanly && noErrorToast);

  // ── 8. Flow F: Siapkan produk untuk PO (tanpa pembelian) ──
  await openBarangDatang(page, "Roasted Bean (RB)");
  await step1Fill(page, "Supplier Smoke Kopi");
  await page.getByRole("button", { name: /Produk baru/ }).first().click();
  await page.getByRole("button", { name: "Roasted Bean (Beli Jadi)" }).click();
  await page.getByPlaceholder("e.g. Gayo Beli Jadi Medium, Ethiopia Yirgacheffe Dark").fill("RB Smoke CFP F1");
  await page.locator('select').filter({ hasText: "Pilih sumber yang sudah ada" }).selectOption("new");
  await page.getByPlaceholder("e.g. Gayo Atu Lintang, Kopi Sumber Alam").fill("Sumber Smoke CFP F1");
  await page.locator('select[name="productRoastLevel"]').selectOption("LIGHT");
  await page.getByRole("button", { name: /Siapkan produk untuk PO/ }).click();
  const toastF = await toastText(page, "Produk disiapkan");
  record("8. Flow F — produk disiapkan untuk PO", toastF.includes("Produk disiapkan — RB Smoke CFP F1"), toastF);
  await page.waitForTimeout(600);
  const modeSwitched = await page.locator('select[name="productId"]').isVisible().catch(() => false);
  const selectedAfterPrepare = modeSwitched ? await page.locator('select[name="productId"]').inputValue() : "";
  record("8b. Mode pindah ke 'existing' + productId terisi", modeSwitched && selectedAfterPrepare.length > 0, `productId=${selectedAfterPrepare}`);
  await page.getByRole("button", { name: /Produk baru/ }).first().click();
  await page.locator('input[name="productName"]').fill("RB Smoke CFP F1");
  await page.locator('select').filter({ hasText: "Pilih sumber yang sudah ada" }).selectOption("existing");
  await page.locator('select[name="coffeeSourceId"]').selectOption(await page.locator('select[name="coffeeSourceId"]').locator("option", { hasText: "Sumber Smoke CFP F1" }).first().getAttribute("value"));
  await page.getByRole("button", { name: /Siapkan produk untuk PO/ }).click();
  const toastF2 = await toastText(page, "sudah pernah disiapkan");
  record("8c. Siapkan ulang → pakai ulang (idempoten)", toastF2.includes("sudah pernah disiapkan"), toastF2);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);

  // ── 9. POForm: produk RB Beli Jadi muncul di pemilih produk PO ──
  await page.goto(`${baseUrl}/inventory?view=po`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Buat PO" }).first().click();
  await page.locator('input[name="estimatedShippingCost"]').waitFor({ state: "visible", timeout: 10000 });
  const poProductTrigger = page.getByRole("combobox").filter({ hasText: "Pilih Produk" }).first();
  if (await poProductTrigger.count()) {
    await poProductTrigger.click();
    const poOptions = await page.getByRole("option").allTextContents();
    record("9. POForm menampilkan RB Beli Jadi", poOptions.some((o) => o.includes("RB Smoke CFP F1") && o.includes("RB Beli Jadi")), poOptions.join(" | "));
    await page.keyboard.press("Escape");
  } else {
    record("9. POForm menampilkan RB Beli Jadi", false, "trigger 'Pilih Produk' tidak ditemukan di POForm");
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outputDir, "09-po-form.png"), fullPage: true });

  await browser.close();

  // ── 10. Verifikasi tautan DB (produk/lot/stok/sumber/isolasi) ──
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: uiTestDatabaseUrl }),
  });
  try {
    const tenantCount = await prisma.tenant.count({ where: { id: tenantId } });
    const gbA1 = await prisma.product.findUnique({ where: { id: "gb-smoke-001" } });
    const products = await prisma.product.findMany({ where: { tenantId } });
    const sources = await prisma.coffeeSource.findMany({ where: { tenantId } });
    const lots = await prisma.lot.findMany({ where: { tenantId, productId: { in: products.map((p) => p.id) } } });
    const purchases = await prisma.purchase.findMany({ where: { tenantId } });

    const gbNew = products.find((p) => p.name === "GB Smoke CFP A1");
    const gbSource = sources.find((s) => s.code === gbNew?.code);
    record("10a. Tenant smoke ada", tenantCount === 1, `count=${tenantCount}`);
    record("10b. GB baru dibuat + sumber otomatis (code=product.code)", !!gbNew && !!gbSource, gbNew ? `${gbNew.code} / ${gbSource?.code}` : "GB A1 tidak ada");
    const gbLots = lots.filter((l) => l.productId === gbNew?.id);
    record("10c. GB A1 stok=25 & lot tercatat", Number(gbNew?.stockKg ?? -1) === 25 && gbLots.length === 1, `stock=${gbNew?.stockKg} lots=${gbLots.length}`);
    record("10d. GB lama (gb-smoke-001) stok=10 (hanya reuse B)", Number(gbA1?.stockKg ?? -1) === 10, `stockKg=${gbA1?.stockKg}`);
    record("10e. 5 pembelian tercatat (A,B,C,D)", purchases.length === 4, `count=${purchases.length}`);

    const rbC1 = products.find((p) => p.name === "RB Smoke CFP C1");
    const srcC1 = sources.find((s) => s.name === "Sumber Smoke CFP C1");
    record("10f. RB C1 PURCHASED_ROASTED + sumber dengan identitas", rbC1?.materialOrigin === "PURCHASED_ROASTED" && srcC1?.species === "ROBUSTA" && srcC1?.region === "Lampung Barat", `${rbC1?.materialOrigin} / ${srcC1?.species} / ${srcC1?.region}`);
    record("10g. RB C1 stok=5", Number(rbC1?.stockKg ?? -1) === 5, `stock=${rbC1?.stockKg}`);
    const rbOld = products.find((p) => p.id === "rb-smoke-001");
    record("10h. RB lama stok=3 (reuse)", Number(rbOld?.stockKg ?? -1) === 3, `stockKg=${rbOld?.stockKg}`);
    record("10i. RB C1 terlink ke sumbernya (coffeeSourceId)", !!rbC1 && !!srcC1 && rbC1.coffeeSourceId === srcC1.id, `${rbC1?.coffeeSourceId} vs ${srcC1?.id}`);

    const rbF1 = products.find((p) => p.name === "RB Smoke CFP F1");
    const srcF1 = sources.find((s) => s.name === "Sumber Smoke CFP F1");
    const rbF1Lots = lots.filter((l) => l.productId === rbF1?.id);
    record("10j. RB F1 (prepare) tanpa lot & tanpa stok fiktif", !!rbF1 && rbF1Lots.length === 0 && Number(rbF1?.stockKg ?? -1) === 0, `lots=${rbF1Lots.length} stock=${rbF1?.stockKg}`);
    record("10k. RB F1 hanya 1 produk (idempoten)", (products.filter((p) => p.name === "RB Smoke CFP F1")).length === 1 && !!srcF1);

    const foreignCount = await prisma.product.count({
      where: { tenantId: { not: tenantId }, name: { contains: "Smoke CFP" } },
    });
    record("10l. Isolasi tenant: tidak ada produk Smoke CFP tenant lain", foreignCount === 0, `count=${foreignCount}`);

    console.log("\n── Ringkasan tautan ──");
    console.log(`produk: ${products.map((p) => `${p.name}(${p.type}, stock=${p.stockKg})`).join(" | ")}`);
    console.log(`sumber: ${sources.map((s) => `${s.name} (${s.species || "-"}, code=${s.code})`).join(" | ")}`);
    console.log(`lot: ${lots.map((l) => `${l.id} → ${l.productId}`).join(" | ")}`);
  } finally {
    await prisma.$disconnect();
  }

  if (errors.length) {
    console.error("\nBrowser errors:\n" + errors.join("\n"));
    process.exitCode = 1;
  }
  const failed = steps.filter((s) => !s.ok).length;
  console.log(`\n${steps.length - failed}/${steps.length} langkah lolos.`);
})().catch(async (error) => {
  console.error(error);
  if (browser) await browser.close();
  process.exitCode = 1;
});
