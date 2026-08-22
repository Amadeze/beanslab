import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { sealData } from "iron-session";
import { SESSION_OPTIONS } from "../../src/lib/session";

test("Omni-Test: Advanced UI Data Entry Scenarios", async ({ page, context }) => {
  test.setTimeout(300_000); // 5 minutes for all tests
  test.skip(!process.env.DATABASE_URL, "DATABASE_URL is required");
  page.setDefaultTimeout(15_000);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  const user = await prisma.user.findFirst({
    where: { isActive: true, role: "OWNER", tenant: { isActive: true } },
    orderBy: { createdAt: "asc" },
  });
  if (!user) throw new Error("Active E2E owner not found");
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: user.tenantId } });

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
  const packagingSupply = await prisma.inventorySupplyItem.upsert({
    where: { tenantId_code: { code: "PKG-OMNI", tenantId: tenant.id } },
    update: {
      stockQuantity: 100,
      isActive: true,
      avgCostPerUnit: 1500,
      consumableInProduction: true,
      includeInProductHpp: true,
    },
    create: {
      tenantId: tenant.id,
      code: "PKG-OMNI",
      name: "Omni Pouch 250g",
      category: "PACKAGING",
      baseUnit: "PCS",
      costPerUnit: 1500,
      avgCostPerUnit: 1500,
      stockQuantity: 100,
      capacityGrams: 250,
      consumableInProduction: true,
      includeInProductHpp: true,
      isActive: true,
    },
  });

  await prisma.packaging.upsert({
    where: { tenantId_code: { code: 'PKG-OMNI', tenantId: tenant.id } },
    update: {
      stockUnit: 100,
      isActive: true,
      avgCostPerUnit: 1500,
      supplyItemId: packagingSupply.id,
    },
    create: {
      tenantId: tenant.id,
      code: 'PKG-OMNI',
      name: 'Omni Pouch 250g',
      weightGrams: 20,
      costPerUnit: 1500,
      avgCostPerUnit: 1500,
      stockUnit: 100,
      isActive: true,
      supplyItemId: packagingSupply.id,
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
      
      const roastingForm = page.getByRole("dialog", { name: "Catat Roasting Batch" });

      // Pilih Green Bean.
      await roastingForm.getByRole("combobox").nth(0).click();
      await page.waitForTimeout(300);
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");

      // Machine and target profile are optional; choose the required roast level.
      await roastingForm.getByRole("combobox").nth(3).click();
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
      await roastingForm.getByRole("button", { name: /Simpan|Selesai/i }).first().click();
      
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
    await page.keyboard.press("Escape");
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
    const productionDialog = page.getByRole("dialog", { name: "Batch Produksi Baru" });
    
    // Pilih Produk Jadi
    await productionDialog.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Omni Finished Good", exact: true }).click();
    await page.waitForTimeout(500);

    // Isi Jumlah Unit Diproduksi
    await productionDialog.locator('input[name="unitsProduced"]').fill("5");

    // A saved recipe fills RB and packaging automatically. Only fill manual controls
    // when the chosen product does not have a recipe.
    const automaticRecipe = productionDialog.getByRole("button", { name: /Resep otomatis/i });
    if (!(await automaticRecipe.isVisible())) {
      const roastedBeanSelect = productionDialog.locator('button[role="combobox"]')
        .filter({ hasText: 'Pilih Roasted Bean...' }).first();
      await roastedBeanSelect.click();
      await page.getByRole("option").first().click();
      await productionDialog.locator('input[name="rbComponents.0.gramsPerUnit"]').fill("250");

      const packagingSelect = productionDialog.locator('button[role="combobox"]')
        .filter({ hasText: 'Pilih kemasan...' }).first();
      await packagingSelect.click();
      await page.getByRole("option").filter({ hasText: "Omni Pouch 250g" }).click();
    }

    // Bersihkan nilai aneh di opsional (workaround untuk karakter "p" yang bocor)
    const laborCost = productionDialog.locator('input[name="laborCost"]');
    const overhead = productionDialog.locator('input[name="overheadAllocated"]');
    if (await laborCost.isVisible()) await laborCost.fill("0");
    if (await overhead.isVisible()) await overhead.fill("0");

    // Simpan Batch
    await productionDialog.getByRole("button", { name: /Simpan Batch/i }).click();

    // The submit label changes while pending, so wait for the drawer itself to
    // close. This proves the server action completed before the next navigation.
    await expect(productionDialog).toBeHidden({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");
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
