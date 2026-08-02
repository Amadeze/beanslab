import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { sealData } from "iron-session";
import { SESSION_OPTIONS } from "../../src/lib/session";

test("UI Data Entry Simulation (No Cleanup)", async ({ page, context }) => {
  test.setTimeout(120_000);
  test.skip(!process.env.DATABASE_URL, "DATABASE_URL is required");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  const tenant = await prisma.tenant.findUnique({ where: { code: 'KIMAISE' } });
  if (!tenant) throw new Error("KIMAISE not found");

  const user = await prisma.user.findFirst({
    where: { email: 'evm.dama26@gmail.com', tenantId: tenant.id }
  });
  if (!user) throw new Error("User EVM not found");

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

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  // SCENARIO 1: Inventory -> Barang Datang (Purchase)
  await test.step("Create Purchase via UI", async () => {
    await page.goto("/inventory", { waitUntil: "networkidle" });
    
    // Tangkap semua notifikasi toast agar terlihat di log
    await page.evaluate(() => {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((m) => {
          m.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement && node.innerText) {
              console.log('TOAST NOTIFICATION:', node.innerText);
            }
          });
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });

    await page.getByRole("button", { name: "Barang Datang", exact: true }).click();
    
    // Interstitial dialog "Barang apa yang datang?"
    await expect(page.getByRole("heading", { name: "Barang apa yang datang?" })).toBeVisible();
    await page.getByRole("button", { name: /Green Bean/ }).click();
    
    // Tunggu Drawer Form Pembelian GB muncul
    await expect(page.getByRole("button", { name: "Lanjut" })).toBeVisible();
    
    // Step 1: Supplier
    await page.locator('select[name="supplierId"]').selectOption({ index: 1 });
    await page.getByRole("button", { name: "Lanjut" }).click();

    // Step 2: Produk & Harga
    await expect(page.getByText("Berat (kg)")).toBeVisible();
    await page.locator('input[name="weightKg"]').fill("60");
    await page.locator('input[name="totalCost"]').fill("6000000");
    
    // Jika ada produk existing, pilih produk pertama
    const productSelect = page.locator('select[name="productId"]');
    if (await productSelect.isVisible()) {
      await productSelect.selectOption({ index: 1 });
    } else {
      // Jika mode new
      await page.locator('input[name="productName"]').fill("UI Test Green Bean");
    }
    await page.getByRole("button", { name: "Lanjut" }).click();

    // Step 3: Pembayaran & Simpan
    await expect(page.getByText("Simpan Pembelian")).toBeVisible();
    await page.getByRole("button", { name: "Simpan Pembelian" }).click();
    
    // Tunggu notifikasi sukses
    await expect(page.getByText(/Barang datang dicatat/i)).toBeVisible({ timeout: 10_000 });
  });

  // SCENARIO 2: Penjualan -> Nota Baru (Invoice)
  await test.step("Create Invoice via UI", async () => {
    await page.goto("/penjualan", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Nota Baru", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "Terbitkan Nota Baru" })).toBeVisible();
    
    // Step 1: Pilih Pelanggan (Combobox pertama)
    await page.getByRole("combobox").nth(0).click();
    await page.waitForTimeout(500); // Tunggu animasi shadcn/ui popover
    await page.getByRole("option").nth(0).click(); 
    await page.waitForTimeout(500);

    // Step 2: Pilih Produk (Combobox kedua)
    await page.getByRole("combobox").nth(1).click();
    await page.waitForTimeout(500);
    // Gunakan keyboard untuk memilih opsi agar kebal terhadap animasi popover
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    // Step 3: Qty
    await page.getByRole("spinbutton").fill("10");

    // Simpan & Terbitkan
    await page.getByRole("button", { name: "Terbitkan Nota" }).click();
    
    // Tunggu notifikasi sukses
    await expect(page.getByText(/berhasil/i)).toBeVisible({ timeout: 10_000 });
  });

  await prisma.$disconnect();
});
