import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { sealData } from "iron-session";
import { SESSION_OPTIONS } from "../../src/lib/session";

test("Omni-Test: Advanced UI Data Entry Scenarios", async ({ page, context }) => {
  test.setTimeout(300_000); // 5 minutes for all tests
  test.skip(!process.env.DATABASE_URL, "DATABASE_URL is required");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  const tenant = await prisma.tenant.findFirst({ where: { code: 'KIMAISE' } });
  if (!tenant) throw new Error("Tenant KIMAISE not found. Jalankan setup_db_minimal.mts?");

  const user = await prisma.user.findFirst({
    where: { email: 'evm.dama26@gmail.com', tenantId: tenant.id }
  });
  if (!user) throw new Error("User EVM not found");

  // Pastikan ada Pelanggan
  await prisma.customer.upsert({
    where: { tenantId_code: { code: 'CUST-OMNI', tenantId: tenant.id } },
    update: { isActive: true },
    create: {
      tenantId: tenant.id,
      code: 'CUST-OMNI',
      name: 'Kafe Pelanggan C',
      tier: 'WHOLESALE_SILVER',
      isActive: true,
    }
  });

  // Pastikan ada Kemasan
  await prisma.packaging.upsert({
    where: { tenantId_code: { code: 'PKG-OMNI', tenantId: tenant.id } },
    update: { stockUnit: 100, isActive: true, avgCostPerUnit: 1500 },
    create: {
      tenantId: tenant.id,
      code: 'PKG-OMNI',
      name: 'Omni Pouch 250g',
      weightGrams: 20,
      costPerUnit: 1500,
      avgCostPerUnit: 1500,
      stockUnit: 100,
      isActive: true,
    }
  });

  // Pastikan ada Account Kasir
  const cashAccount = await prisma.account.upsert({
    where: { tenantId_code: { code: 'KAS-OMNI', tenantId: tenant.id } },
    update: { isActive: true },
    create: {
      tenantId: tenant.id,
      code: 'KAS-OMNI',
      name: 'Kasir Utama',
      type: 'ASSET',
      isActive: true,
    }
  });

  // Pastikan ada GB
  await prisma.product.upsert({
    where: { tenantId_code: { code: 'GB-GAYO', tenantId: tenant.id } },
    update: { stockKg: 10, isActive: true, avgCostPerKg: 85000 },
    create: {
      tenantId: tenant.id,
      code: 'GB-GAYO',
      name: 'Green Bean Gayo',
      type: 'GREEN_BEAN',
      category: 'COMMODITY',
      stockKg: 10,
      price: 85000,
      avgCostPerKg: 85000,
      isActive: true,
    }
  });

  // Pastikan ada Finished Good dengan stok untuk form Invoice
  await prisma.product.upsert({
    where: { tenantId_code: { code: 'OMNI-FG-001', tenantId: tenant.id } },
    update: { stockUnit: 100, isActive: true },
    create: {
      tenantId: tenant.id,
      code: 'OMNI-FG-001',
      name: 'Omni Finished Good',
      type: 'FINISHED_GOODS',
      category: 'RETAIL',
      isActive: true,
      stockUnit: 100,
      price: 150000,
    }
  });

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

  // =========================================================================
  // SCENARIO 1: Pembelian (Purchase) - Partial Payment
  // =========================================================================
  await test.step("Create Purchase with Partial Payment (DP)", async () => {
    await page.goto("/inventory", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Barang Datang", exact: true }).click();
    
    await expect(page.getByRole("heading", { name: "Barang apa yang datang?" })).toBeVisible();
    await page.getByRole("button", { name: /Green Bean/ }).click();
    
    await expect(page.getByRole("button", { name: "Lanjut" })).toBeVisible();
    
    // Step 1: Supplier
    await page.locator('select[name="supplierId"]').selectOption({ index: 1 });
    await page.getByRole("button", { name: "Lanjut" }).click();

    // Step 2: Produk & Harga
    await expect(page.getByText("Berat (kg)")).toBeVisible();
    await page.locator('input[name="weightKg"]').fill("100");
    await page.locator('input[name="totalCost"]').fill("10000000"); // 10 juta
    
    const productSelect = page.locator('select[name="productId"]');
    if (await productSelect.isVisible()) {
      await productSelect.selectOption({ index: 1 });
    } else {
      await page.locator('input[name="productName"]').fill("Omni Green Bean");
    }
    await page.getByRole("button", { name: "Lanjut" }).click();

    // Step 3: Pembayaran & Simpan (Partial Payment)
    await expect(page.getByText("Simpan Pembelian")).toBeVisible();
    // Klik "Bayar sebagian"
    await page.getByRole("button", { name: "Bayar sebagian" }).click();
    // Isi DP
    await page.locator('input[name="initialPaidAmount"]').fill("4000000"); // DP 4 juta
    
    await page.getByRole("button", { name: "Simpan Pembelian" }).click();
    
    // Tunggu notifikasi sukses
    await expect(page.getByText(/Barang datang dicatat/i)).toBeVisible({ timeout: 10_000 });
  });

  // =========================================================================
  // SCENARIO 3: Produksi / Roasting Batch Baru
  // =========================================================================
  await test.step("Create Roasting Batch", async () => {
    await page.goto("/roasting", { waitUntil: "networkidle" });
    
    // Cari tombol Roast Batch / Catat Roasting
    const btnRoast = page.getByRole("button", { name: /Roast|Catat/i }).first();
    if (await btnRoast.isVisible()) {
      await btnRoast.click();
      
      // Tunggu form muncul
      await expect(page.getByText(/Green Bean/i).first()).toBeVisible({ timeout: 5000 });
      
      // Isi target weight (Pre-roast)
      await page.locator('input[name="targetWeightKg"]').fill("10");
      
      // Pilih Mesin (Combobox pertama di roasting form)
      await page.getByRole("combobox").nth(0).click();
      await page.waitForTimeout(300);
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");

      // Pilih Green Bean input (Combobox kedua)
      await page.getByRole("combobox").nth(1).click();
      await page.waitForTimeout(500);
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(500);

      // Pilih Roast Level (Combobox ketiga)
      await page.getByRole("combobox").nth(2).click();
      await page.waitForTimeout(500);
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(500);

      // Isi actual output (Roasted)
      const actualOut = page.locator('input[name="actualOutputKg"]');
      if (await actualOut.isVisible()) {
        await actualOut.fill("8.5");
      }

      // Pilih / Buat Produk Output
      const btnPilihProduk = page.getByRole("button", { name: /Produk yang sudah ada/i });
      if (await btnPilihProduk.isVisible()) {
        await btnPilihProduk.click();
        await page.getByRole("combobox").nth(3).click();
        await page.waitForTimeout(500);
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Enter");
      }

      // Klik simpan
      await page.getByRole("button", { name: /Simpan|Selesai/i }).first().click();
      
      // Tunggu notifikasi
      await expect(page.getByText(/berhasil|masuk stok/i).first()).toBeVisible({ timeout: 10_000 });
    } else {
      console.log("Tombol Roast Batch tidak ditemukan, melewati skenario Roasting.");
    }
  });

  // =========================================================================
  // SCENARIO 2: Penjualan (Invoice) - Tempo (Bayar Nanti)
  // =========================================================================
  await test.step("Create Invoice with Tempo (Credit)", async () => {
    await page.goto("/penjualan", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Nota Baru", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "Terbitkan Nota Baru" })).toBeVisible();
    
    // Step 1: Pilih Pelanggan (Combobox pertama)
    await page.locator('button[role="combobox"]').filter({ hasText: /Cari dan pilih customer|Pilih pelanggan/i }).first().click();
    await page.waitForTimeout(500); 
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    // Step 2: Pilih Produk
    await page.locator('button[role="combobox"]').filter({ hasText: 'Pilih produk...' }).first().click();
    await page.waitForTimeout(500);
    await page.keyboard.type("Omni");
    await page.waitForTimeout(500);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    // Step 3: Qty
    await page.getByRole("spinbutton").fill("1"); // Isi 1 saja agar tidak melebihi stok hasil roasting (8.5kg)

    // Lanjut ke step Pembayaran (Step 2)
    await page.getByRole("button", { name: "Lanjut" }).click();
    await page.waitForTimeout(500); // Tunggu transisi step form

    // Pembayaran: Tempo
    await page.getByRole("button", { name: /TEMPO/i }).click();
    
    // Lanjut ke step Ringkasan (Step 3)
    await page.getByRole("button", { name: "Lanjut" }).click();

    // Simpan & Terbitkan
    await page.getByRole("button", { name: /Buat Pesanan|Terbitkan/i }).first().click();
    
    // Tunggu notifikasi sukses
    await expect(page.getByText(/berhasil/i).first()).toBeVisible({ timeout: 10_000 });
  });

  await test.step("Skenario 4: Produksi & Packing", async () => {
    await page.goto('/produksi');
    await page.waitForLoadState("networkidle");

    // Buka Drawer Batch Baru
    await page.getByRole("button", { name: /Batch Baru/i }).first().click();
    
    // Pilih Produk Jadi
    await page.locator('button[role="combobox"]').filter({ hasText: 'Pilih SKU Produk Jadi...' }).first().click();
    await page.waitForTimeout(500);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    // Isi Jumlah Unit Diproduksi
    await page.locator('input[name="unitsProduced"]').fill("5");

    // Pilih Roasted Bean
    await page.locator('button[role="combobox"]').filter({ hasText: 'Pilih Roasted Bean...' }).first().click();
    await page.waitForTimeout(500);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    // Isi Gramasi per Unit
    await page.locator('input[name="rbComponents.0.gramsPerUnit"]').fill("250");

    // Pilih Kemasan
    await page.locator('button[role="combobox"]').filter({ hasText: 'Pilih kemasan...' }).first().click();
    await page.waitForTimeout(500);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    // Bersihkan nilai aneh di opsional (workaround untuk karakter "p" yang bocor)
    await page.locator('input[name="laborCost"]').fill("0");
    await page.locator('input[name="overheadAllocated"]').fill("0");

    // Simpan Batch
    await page.getByRole("button", { name: /Simpan Batch/i }).click();

    // Pastikan sukses tertutup
    await expect(page.getByRole("button", { name: /Simpan Batch/i })).toBeHidden({ timeout: 15_000 });
  });

  await test.step("Skenario 5: Buka Kasir (B2C Point of Sales)", async () => {
    await page.goto('/kasir');
    await page.waitForLoadState("networkidle");

    // Tambah Produk ke Keranjang (Klik product card)
    await page.getByRole("button", { name: /Tambah Omni Finished Good/i }).first().click();
    await page.waitForTimeout(500);

    // Klik tombol Bayar (Mobile/Desktop)
    await page.getByRole("button", { name: /Bayar/i }).first().click();

    // Tunggu notifikasi atau dialog selesai pembayaran
    await expect(page.getByText(/berhasil dibayar/i)).toBeVisible({ timeout: 10_000 });
  });

  await test.step("Skenario 6: Cupping Session", async () => {
    await page.goto('/cupping');
    await page.waitForLoadState("networkidle");

    // Pilih Batch yang baru saja di-roasting
    // Dropdown di cupping menggunakan Shadcn Select (role="combobox" dengan text "Pilih batch terbaru")
    await page.locator('button[role="combobox"]').filter({ hasText: 'Pilih batch terbaru' }).first().click();
    await page.waitForTimeout(500);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    // Isi Evaluator
    await page.getByLabel(/Evaluator/i).fill("Playwright Tester");

    // Simpan Cupping
    await page.getByRole("button", { name: /Simpan hasil cupping/i }).click();

    // Notifikasi sukses
    await expect(page.getByText(/tersimpan/i)).toBeVisible({ timeout: 10_000 });
  });

  await test.step("Skenario 7: Keuangan (Pencatatan Biaya)", async () => {
    await page.goto('/keuangan');
    await page.waitForLoadState("networkidle");

    // Klik tombol "Catat Pengeluaran"
    await page.getByRole("button", { name: /Catat/i }).first().click();

    // Pilih Kategori
    await page.locator('button[role="combobox"]').filter({ hasText: 'Pilih kategori pengeluaran' }).first().click();
    await page.waitForTimeout(500);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    // Isi formulir pengeluaran
    await page.locator('input[name="amount"]').fill("50000");
    await page.locator('textarea[name="description"]').fill("Operasional E2E Test");

    // Simpan
    await page.getByRole("button", { name: /Simpan/i }).first().click();

    // Tunggu notifikasi
    await expect(page.getByText(/berhasil/i).first()).toBeVisible({ timeout: 10_000 });
  });

  await prisma.$disconnect();
});
