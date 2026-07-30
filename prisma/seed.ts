/**
 * ROS NALWENG — Prisma Seed Script
 * ──────────────────────────────────────────────────────────────────────────────
 * Jalankan: npm run seed
 * Requires:  .env.local  berisi  DATABASE_URL=postgresql://...
 *
 * Urutan transaksi:
 *   1. Master Data (User, Supplier, Customer, Product, Packaging, Recipe)
 *   2. Barang Datang: 2× GB + 1× Packaging
 *   3. Roasting: 2 batch (Gayo + Robusta)
 *   4. Produksi: 2 batch blending (Full Arabica + Blend A)
 *   5. 3 Penjualan (1 Lunas, 2 Tempo)
 *   6. 1 Pembayaran Piutang (Kafe B lunas via Transfer BCA)
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

// ── Env sudah di-load oleh tsx --env-file=.env.local ──
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
const prisma  = new PrismaClient({ adapter });

// =============================================================================
// HELPERS
// =============================================================================

/** Tanggal simulasi (agar log terlihat realistis) */
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(9, 0, 0, 0);
  return d;
}
function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(23, 59, 0, 0);
  return d;
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log("🌱  Starting ROS Nalweng seed...\n");

  let tenant = await prisma.tenant.findUnique({where: {code: 'NALWENG'}});
  if (!tenant) {
    tenant = await prisma.tenant.create({data: {name: 'Nalweng Roastery', code: 'NALWENG', ownerCapital: 80_000_000, initialCash: 20_000_000}});
  } else {
    tenant = await prisma.tenant.update({
      where: {code: 'NALWENG'},
      data: {ownerCapital: 80_000_000, initialCash: 20_000_000},
    });
  }


  // ─────────────────────────────────────────────────────────────────────────
  // 0. SYSTEM USER
  // ─────────────────────────────────────────────────────────────────────────

  const systemPassword = await bcrypt.hash("system", 10);
  const systemUser = await prisma.user.upsert({
    where:  { email: "system@ros.internal" },
    update: { password: systemPassword },
    create: { tenantId: tenant.id, 
      name:     "System",
      email:    "system@ros.internal",
      password: systemPassword,
      role:     "OWNER",
    },
  });
  console.log("✓  System user");

  // ─────────────────────────────────────────────────────────────────────────
  // 1. SUPPLIERS
  // ─────────────────────────────────────────────────────────────────────────

  const [supGayo, supRobusta] = await Promise.all([
    prisma.supplier.upsert({
      where:  { tenantId_code: { tenantId: tenant.id, code: "SUP-202507-001" } },
      update: {},
      create: { tenantId: tenant.id, 
        code:    "SUP-202507-001",
        name:    "Koperasi Kopi Gayo",
        phone:   "0812-0000-0001",
        region:  "Gayo, Aceh",
        address: "Jl. Kebun Kopi No. 1, Bener Meriah, Aceh",
      },
    }),
    prisma.supplier.upsert({
      where:  { tenantId_code: { tenantId: tenant.id, code: "SUP-202507-002" } },
      update: {},
      create: { tenantId: tenant.id, 
        code:    "SUP-202507-002",
        name:    "Mitra Robusta Nusantara",
        phone:   "0813-0000-0002",
        region:  "Lampung",
        address: "Jl. Perkebunan No. 5, Bandar Lampung",
      },
    }),
  ]);
  console.log("✓  Suppliers (2)");

  // ─────────────────────────────────────────────────────────────────────────
  // 2. CUSTOMERS
  // ─────────────────────────────────────────────────────────────────────────

  const [custA, custB, custC] = await Promise.all([
    prisma.customer.upsert({
      where:  { tenantId_code: { tenantId: tenant.id, code: "CST-202507-001" } },
      update: {},
      create: { tenantId: tenant.id, 
        code:    "CST-202507-001",
        name:    "Kafe A",
        phone:   "021-1111-0001",
        email:   "kafe.a@example.com",
        address: "Jl. Sudirman No. 10, Jakarta",
      },
    }),
    prisma.customer.upsert({
      where:  { tenantId_code: { tenantId: tenant.id, code: "CST-202507-002" } },
      update: {},
      create: { tenantId: tenant.id, 
        code:    "CST-202507-002",
        name:    "Kafe B",
        phone:   "022-2222-0002",
        email:   "kafe.b@example.com",
        address: "Jl. Braga No. 25, Bandung",
      },
    }),
    prisma.customer.upsert({
      where:  { tenantId_code: { tenantId: tenant.id, code: "CST-202507-003" } },
      update: {},
      create: { tenantId: tenant.id, 
        code:    "CST-202507-003",
        name:    "Kafe C",
        phone:   "031-3333-0003",
        email:   "kafe.c@example.com",
        address: "Jl. Tunjungan No. 8, Surabaya",
      },
    }),
  ]);
  console.log("✓  Customers (3): Kafe A, Kafe B, Kafe C");

  // ─────────────────────────────────────────────────────────────────────────
  // 3. PRODUCTS — Green Bean
  // ─────────────────────────────────────────────────────────────────────────

  const [gbGayo, gbRobusta] = await Promise.all([
    prisma.product.upsert({
      where:  { tenantId_code: { tenantId: tenant.id, code: "GB-GAYO" } },
      update: {},
      create: { tenantId: tenant.id, 
        code:        "GB-GAYO",
        name:        "Gayo Mentah",
        type:        "GREEN_BEAN",
        origin:      "Gayo, Aceh",
        description: "Green bean Arabica single origin Gayo, Aceh",
      },
    }),
    prisma.product.upsert({
      where:  { tenantId_code: { tenantId: tenant.id, code: "GB-ROBUSTA" } },
      update: {},
      create: { tenantId: tenant.id, 
        code:        "GB-ROBUSTA",
        name:        "Robusta Mentah",
        type:        "GREEN_BEAN",
        origin:      "Lampung",
        description: "Green bean Robusta Lampung kualitas premium",
      },
    }),
  ]);
  console.log("✓  Green Bean products (2)");

  // ─────────────────────────────────────────────────────────────────────────
  // 4. PRODUCTS — Roasted Bean (dibuat sebagai master produk, stok akan
  //    muncul setelah transaksi roasting)
  // ─────────────────────────────────────────────────────────────────────────

  const [rbGayo, rbRobusta] = await Promise.all([
    prisma.product.upsert({
      where:  { tenantId_code: { tenantId: tenant.id, code: "RB-GAYO" } },
      update: {},
      create: { tenantId: tenant.id, 
        code:       "RB-GAYO",
        name:       "RB Gayo",
        type:       "ROASTED_BEAN",
        origin:     "Gayo, Aceh",
        roastLevel: "MEDIUM",
      },
    }),
    prisma.product.upsert({
      where:  { tenantId_code: { tenantId: tenant.id, code: "RB-ROBUSTA" } },
      update: {},
      create: { tenantId: tenant.id, 
        code:       "RB-ROBUSTA",
        name:       "RB Robusta",
        type:       "ROASTED_BEAN",
        origin:     "Lampung",
        roastLevel: "MEDIUM_DARK",
      },
    }),
  ]);
  console.log("✓  Roasted Bean products (2)");

  // ─────────────────────────────────────────────────────────────────────────
  // 5. PRODUCTS — Finished Goods
  // ─────────────────────────────────────────────────────────────────────────

  const [fgFullArabica, fgBlendA] = await Promise.all([
    prisma.product.upsert({
      where:  { tenantId_code: { tenantId: tenant.id, code: "FG-FULL-ARABICA" } },
      update: {},
      create: { tenantId: tenant.id, 
        code:        "FG-FULL-ARABICA",
        name:        "Full Arabica 1KG",
        type:        "FINISHED_GOODS",
        origin:      "Gayo, Aceh",
        description: "Single origin Arabica Gayo roasted medium, kemasan Pouch 1KG",
      },
    }),
    prisma.product.upsert({
      where:  { tenantId_code: { tenantId: tenant.id, code: "FG-BLEND-A" } },
      update: {},
      create: { tenantId: tenant.id, 
        code:        "FG-BLEND-A",
        name:        "Blend A 1KG",
        type:        "FINISHED_GOODS",
        description: "Blend Arabica 50% + Robusta 50%, kemasan Pouch 1KG",
      },
    }),
  ]);
  console.log("✓  Finished Goods products (2)");

  // ─────────────────────────────────────────────────────────────────────────
  // 6. PACKAGING
  // ─────────────────────────────────────────────────────────────────────────

  const pkgPouch1KG = await prisma.packaging.upsert({
    where:  { tenantId_code: { tenantId: tenant.id, code: "PKG-POUCH-1KG" } },
    update: {},
    create: { tenantId: tenant.id, 
      code:        "PKG-POUCH-1KG",
      name:        "Pouch 1KG",
      weightGrams: 55,        // berat kemasan kosong 55g
      costPerUnit: 5000,      // HPP kemasan Rp 5.000/pcs
    },
  });
  console.log("✓  Packaging (1): Pouch 1KG");

  // ─────────────────────────────────────────────────────────────────────────
  // 7. RECIPES
  // ─────────────────────────────────────────────────────────────────────────

  // Recipe: Full Arabica — 100% RB Gayo, 1000g/unit
  const recipeFullArabica = await prisma.recipe.upsert({
    where:  { tenantId_code: { tenantId: tenant.id, code: "RCP-FULL-ARABICA" } },
    update: {},
    create: { tenantId: tenant.id, 
      code:        "RCP-FULL-ARABICA",
      name:        "Full Arabica 1KG",
      productId:   fgFullArabica.id,
      packagingId: pkgPouch1KG.id,
      outputGrams: 1000,
      notes:       "100% Arabica Gayo, roast medium",
    },
  });

  await prisma.recipeItem.upsert({
    where:  { recipeId_productId: { recipeId: recipeFullArabica.id, productId: rbGayo.id } },
    update: {},
    create: { tenantId: tenant.id, recipeId:     recipeFullArabica.id,
      productId:    rbGayo.id,
      ratioPercent: 100,
      gramsPerUnit: 1000,
    },
  });

  // Recipe: Blend A — 50% Gayo + 50% Robusta, 1000g/unit
  const recipeBlendA = await prisma.recipe.upsert({
    where:  { tenantId_code: { tenantId: tenant.id, code: "RCP-BLEND-A" } },
    update: {},
    create: { tenantId: tenant.id, 
      code:        "RCP-BLEND-A",
      name:        "Blend A 1KG",
      productId:   fgBlendA.id,
      packagingId: pkgPouch1KG.id,
      outputGrams: 1000,
      notes:       "Arabica Gayo 50% + Robusta Lampung 50%",
    },
  });

  await Promise.all([
    prisma.recipeItem.upsert({
      where:  { recipeId_productId: { recipeId: recipeBlendA.id, productId: rbGayo.id } },
      update: {},
      create: { tenantId: tenant.id, recipeId:     recipeBlendA.id,
        productId:    rbGayo.id,
        ratioPercent: 50,
        gramsPerUnit: 500,
      },
    }),
    prisma.recipeItem.upsert({
      where:  { recipeId_productId: { recipeId: recipeBlendA.id, productId: rbRobusta.id } },
      update: {},
      create: { tenantId: tenant.id, recipeId:     recipeBlendA.id,
        productId:    rbRobusta.id,
        ratioPercent: 50,
        gramsPerUnit: 500,
      },
    }),
  ]);
  console.log("✓  Recipes (2): Full Arabica, Blend A");

  // ─────────────────────────────────────────────────────────────────────────
  // 8. PURCHASE — Barang Datang GB Gayo (10kg @ Rp 100.000/kg)
  //    HPP = (100000 × 10 + 0) / 10 = Rp 100.000/kg
  // ─────────────────────────────────────────────────────────────────────────

  const purGayo = await prisma.purchase.create({
    data: { tenantId: tenant.id, 
      code:         "PUR-202507-001",
      type:         "GREEN_BEAN",
      supplierId:   supGayo.id,
      productId:    gbGayo.id,
      weightKg:     10,
      pricePerUnit: 100_000,
      shippingCost: 0,
      totalCost:    1_000_000,
      status:       "COMPLETED",
      paymentStatus: "PAID",
      paidAmount:    1_000_000,
      receivedAt:   daysAgo(5),
      notes:        "Lot Juli 2026 — Grade 1 Specialty",
      createdById:  systemUser.id,
      createdAt:    daysAgo(5),
    },
  });
  await prisma.inventoryLedger.create({
    data: { tenantId: tenant.id, 
      productId:   gbGayo.id,
      entryType:   "IN",
      refType:     "PURCHASE_GB",
      refId:       purGayo.id,
      quantityKg:  10,
      notes:       `Barang Datang ${purGayo.code}`,
      createdById: systemUser.id,
      createdAt:   daysAgo(5),
    },
  });
  console.log("✓  Purchase GB Gayo 10kg — PUR-202507-001");

  // ─────────────────────────────────────────────────────────────────────────
  // 9. PURCHASE — Barang Datang GB Robusta (10kg @ Rp 80.000/kg)
  //    HPP = Rp 80.000/kg
  // ─────────────────────────────────────────────────────────────────────────

  const purRobusta = await prisma.purchase.create({
    data: { tenantId: tenant.id, 
      code:         "PUR-202507-002",
      type:         "GREEN_BEAN",
      supplierId:   supRobusta.id,
      productId:    gbRobusta.id,
      weightKg:     10,
      pricePerUnit: 80_000,
      shippingCost: 0,
      totalCost:    800_000,
      status:       "COMPLETED",
      paymentStatus: "PAID",
      paidAmount:    800_000,
      receivedAt:   daysAgo(5),
      notes:        "Lot Juli 2026 — Grade A",
      createdById:  systemUser.id,
      createdAt:    daysAgo(5),
    },
  });
  await prisma.inventoryLedger.create({
    data: { tenantId: tenant.id, 
      productId:   gbRobusta.id,
      entryType:   "IN",
      refType:     "PURCHASE_GB",
      refId:       purRobusta.id,
      quantityKg:  10,
      notes:       `Barang Datang ${purRobusta.code}`,
      createdById: systemUser.id,
      createdAt:   daysAgo(5),
    },
  });
  console.log("✓  Purchase GB Robusta 10kg — PUR-202507-002");

  // ─────────────────────────────────────────────────────────────────────────
  // 10. PURCHASE — Barang Datang Packaging Pouch 1KG (50 pcs @ Rp 5.000)
  // ─────────────────────────────────────────────────────────────────────────

  const purPkg = await prisma.purchase.create({
    data: { tenantId: tenant.id, 
      code:          "PUR-202507-003",
      type:          "PACKAGING",
      supplierId:    supGayo.id,      // supplier apa saja, pakai supGayo
      packagingId:   pkgPouch1KG.id,
      quantityUnits: 50,
      pricePerUnit:  5_000,
      shippingCost:  0,
      totalCost:     250_000,
      status:        "COMPLETED",
      paymentStatus: "PAID",
      paidAmount:    250_000,
      receivedAt:    daysAgo(5),
      notes:         "Stok kemasan Pouch 1KG",
      createdById:   systemUser.id,
      createdAt:     daysAgo(5),
    },
  });
  await prisma.inventoryLedger.create({
    data: { tenantId: tenant.id, 
      packagingId:  pkgPouch1KG.id,
      entryType:    "IN",
      refType:      "PURCHASE_PKG",
      refId:        purPkg.id,
      quantityUnit: 50,
      notes:        `Barang Datang ${purPkg.code}`,
      createdById:  systemUser.id,
      createdAt:    daysAgo(5),
    },
  });
  console.log("✓  Purchase PKG Pouch 1KG 50pcs — PUR-202507-003");

  // ─────────────────────────────────────────────────────────────────────────
  // 11. ROASTING — Gayo (10kg → 8.5kg, shrinkage 15%)
  //     RB Gayo HPP/kg = 100.000 / 0.85 ≈ 117.647
  // ─────────────────────────────────────────────────────────────────────────

  const rstGayo = await prisma.parentRoastingBatch.create({
    data: { tenantId: tenant.id, 
      code:             "RST-202507-001",
      inputProductId:   gbGayo.id,
      targetWeightKg:    10,
      outputProductId:  rbGayo.id,
      actualOutputKg:   8.5,
      totalShrinkagePercent: 15.00,
      status:           "COMPLETED",
      notes:            "Batch pertama — profile medium, development 22%",
      createdById:      systemUser.id,
      createdAt:        daysAgo(4),
    },
  });
  await Promise.all([
    prisma.inventoryLedger.create({
      data: { tenantId: tenant.id, 
        productId:   gbGayo.id,
        entryType:   "OUT",
        refType:     "ROASTING_GB_OUT",
        refId:       rstGayo.id,
        quantityKg:  10,
        notes:       `Roasting ${rstGayo.code}`,
        createdById: systemUser.id,
        createdAt:   daysAgo(4),
      },
    }),
    prisma.inventoryLedger.create({
      data: { tenantId: tenant.id, 
        productId:   rbGayo.id,
        entryType:   "IN",
        refType:     "ROASTING_RB_IN",
        refId:       rstGayo.id,
        quantityKg:  8.5,
        notes:       `Roasting ${rstGayo.code}`,
        createdById: systemUser.id,
        createdAt:   daysAgo(4),
      },
    }),
  ]);
  console.log("✓  Roasting Gayo 10kg → 8.5kg (15% susut) — RST-202507-001");

  // ─────────────────────────────────────────────────────────────────────────
  // 12. ROASTING — Robusta (10kg → 8.7kg, shrinkage 13%)
  //     RB Robusta HPP/kg = 80.000 / 0.87 ≈ 91.954
  // ─────────────────────────────────────────────────────────────────────────

  const rstRobusta = await prisma.parentRoastingBatch.create({
    data: { tenantId: tenant.id, 
      code:             "RST-202507-002",
      inputProductId:   gbRobusta.id,
      targetWeightKg:    20,
      outputProductId:  rbRobusta.id,
      actualOutputKg:   16.4,
      totalShrinkagePercent: 18.00,
      status:           "COMPLETED",
      notes:            "Profile medium-dark, body tebal",
      createdById:      systemUser.id,
      createdAt:        daysAgo(4),
    },
  });
  await Promise.all([
    prisma.inventoryLedger.create({
      data: { tenantId: tenant.id, 
        productId:   gbRobusta.id,
        entryType:   "OUT",
        refType:     "ROASTING_GB_OUT",
        refId:       rstRobusta.id,
        quantityKg:  10,
        notes:       `Roasting ${rstRobusta.code}`,
        createdById: systemUser.id,
        createdAt:   daysAgo(4),
      },
    }),
    prisma.inventoryLedger.create({
      data: { tenantId: tenant.id, 
        productId:   rbRobusta.id,
        entryType:   "IN",
        refType:     "ROASTING_RB_IN",
        refId:       rstRobusta.id,
        quantityKg:  8.7,
        notes:       `Roasting ${rstRobusta.code}`,
        createdById: systemUser.id,
        createdAt:   daysAgo(4),
      },
    }),
  ]);
  console.log("✓  Roasting Robusta 10kg → 8.7kg (13% susut) — RST-202507-002");

  // ─────────────────────────────────────────────────────────────────────────
  // 13. PRODUKSI — Full Arabica (5 unit × 1kg)
  //     Bahan: RB Gayo 5kg, Pouch 5pcs
  //     RB cost  : 5 × 117.647 = 588.235
  //     PKG cost : 5 × 5.000   =  25.000
  //     Total    :              613.235
  //     HPP/unit :              122.647
  // ─────────────────────────────────────────────────────────────────────────

  const prdFullArabica = await prisma.productionBatch.create({
    data: { tenantId: tenant.id, 
      code:           "PRD-202507-001",
      recipeId:       recipeFullArabica.id,
      outputProductId: fgFullArabica.id,
      packagingId:    pkgPouch1KG.id,
      unitsProduced:  5,
      totalRbUsedKg:  5,
      hppPerUnit:     122_647,
      status:         "COMPLETED",
      producedAt:     daysAgo(3),
      notes:          "Batch perdana Full Arabica — 5 pouch 1KG",
      createdById:    systemUser.id,
      createdAt:      daysAgo(3),
    },
  });
  await Promise.all([
    // RB Gayo OUT
    prisma.inventoryLedger.create({
      data: { tenantId: tenant.id, 
        productId:   rbGayo.id,
        entryType:   "OUT",
        refType:     "PRODUCTION_RB_OUT",
        refId:       prdFullArabica.id,
        quantityKg:  5,
        notes:       `Produksi ${prdFullArabica.code} — RB Gayo`,
        createdById: systemUser.id,
        createdAt:   daysAgo(3),
      },
    }),
    // PKG OUT
    prisma.inventoryLedger.create({
      data: { tenantId: tenant.id, 
        packagingId:  pkgPouch1KG.id,
        entryType:    "OUT",
        refType:      "PRODUCTION_PKG_OUT",
        refId:        prdFullArabica.id,
        quantityUnit: 5,
        notes:        `Produksi ${prdFullArabica.code} — Pouch 1KG`,
        createdById:  systemUser.id,
        createdAt:    daysAgo(3),
      },
    }),
    // FG IN
    prisma.inventoryLedger.create({
      data: { tenantId: tenant.id, 
        productId:    fgFullArabica.id,
        entryType:    "IN",
        refType:      "PRODUCTION_FG_IN",
        refId:        prdFullArabica.id,
        quantityUnit: 5,
        notes:        `Produksi ${prdFullArabica.code} — Full Arabica 1KG`,
        createdById:  systemUser.id,
        createdAt:    daysAgo(3),
      },
    }),
  ]);
  console.log("✓  Produksi Full Arabica 5 unit — PRD-202507-001");

  // ─────────────────────────────────────────────────────────────────────────
  // 14. PRODUKSI — Blend A (5 unit × 1kg)
  //     Bahan: RB Gayo 2.5kg + RB Robusta 2.5kg + Pouch 5pcs
  //     RB Gayo cost    : 2.5 × 117.647 = 294.118
  //     RB Robusta cost : 2.5 ×  91.954 = 229.885
  //     PKG cost        : 5   ×   5.000 =  25.000
  //     Total           :               549.003
  //     HPP/unit        :               109.801
  // ─────────────────────────────────────────────────────────────────────────

  const prdBlendA = await prisma.productionBatch.create({
    data: { tenantId: tenant.id, 
      code:            "PRD-202507-002",
      recipeId:        recipeBlendA.id,
      outputProductId: fgBlendA.id,
      packagingId:     pkgPouch1KG.id,
      unitsProduced:   5,
      totalRbUsedKg:   5,
      hppPerUnit:      109_801,
      status:          "COMPLETED",
      producedAt:      daysAgo(3),
      notes:           "Batch perdana Blend A — 5 pouch 1KG",
      createdById:     systemUser.id,
      createdAt:       daysAgo(3),
    },
  });
  await Promise.all([
    // RB Gayo OUT (2.5kg)
    prisma.inventoryLedger.create({
      data: { tenantId: tenant.id, 
        productId:   rbGayo.id,
        entryType:   "OUT",
        refType:     "PRODUCTION_RB_OUT",
        refId:       prdBlendA.id,
        quantityKg:  2.5,
        notes:       `Produksi ${prdBlendA.code} — RB Gayo`,
        createdById: systemUser.id,
        createdAt:   daysAgo(3),
      },
    }),
    // RB Robusta OUT (2.5kg)
    prisma.inventoryLedger.create({
      data: { tenantId: tenant.id, 
        productId:   rbRobusta.id,
        entryType:   "OUT",
        refType:     "PRODUCTION_RB_OUT",
        refId:       prdBlendA.id,
        quantityKg:  2.5,
        notes:       `Produksi ${prdBlendA.code} — RB Robusta`,
        createdById: systemUser.id,
        createdAt:   daysAgo(3),
      },
    }),
    // PKG OUT
    prisma.inventoryLedger.create({
      data: { tenantId: tenant.id, 
        packagingId:  pkgPouch1KG.id,
        entryType:    "OUT",
        refType:      "PRODUCTION_PKG_OUT",
        refId:        prdBlendA.id,
        quantityUnit: 5,
        notes:        `Produksi ${prdBlendA.code} — Pouch 1KG`,
        createdById:  systemUser.id,
        createdAt:    daysAgo(3),
      },
    }),
    // FG IN
    prisma.inventoryLedger.create({
      data: { tenantId: tenant.id, 
        productId:    fgBlendA.id,
        entryType:    "IN",
        refType:      "PRODUCTION_FG_IN",
        refId:        prdBlendA.id,
        quantityUnit: 5,
        notes:        `Produksi ${prdBlendA.code} — Blend A 1KG`,
        createdById:  systemUser.id,
        createdAt:    daysAgo(3),
      },
    }),
  ]);
  console.log("✓  Produksi Blend A 5 unit — PRD-202507-002");

  // ─────────────────────────────────────────────────────────────────────────
  // 15. INVOICE 1 — Kafe A: LUNAS
  //     2 Full Arabica @ Rp 200.000  = 400.000
  //     2 Blend A      @ Rp 180.000  = 360.000
  //     Grand Total                  = 760.000
  //     Payment: CASH, langsung lunas
  // ─────────────────────────────────────────────────────────────────────────

  const inv1 = await prisma.invoice.create({
    data: { tenantId: tenant.id, 
      code:        "INV-202507-001",
      customerId:  custA.id,
      subtotal:    760_000,
      discount:    0,
      tax:         0,
      grandTotal:  760_000,
      paidAmount:  760_000,
      status:      "PAID",
      issuedAt:    daysAgo(1),
      notes:       "Order rutin Kafe A",
      createdById: systemUser.id,
      createdAt:   daysAgo(1),
    },
  });
  // Line items
  await Promise.all([
    prisma.invoiceItem.create({
      data: { tenantId: tenant.id, invoiceId: inv1.id,
        productId: fgFullArabica.id,
        quantity:  2,
        unitPrice: 200_000,
        discount:  0,
        subtotal:  400_000,
        hpp:       122_647,
      },
    }),
    prisma.invoiceItem.create({
      data: { tenantId: tenant.id, invoiceId: inv1.id,
        productId: fgBlendA.id,
        quantity:  2,
        unitPrice: 180_000,
        discount:  0,
        subtotal:  360_000,
        hpp:       109_801,
      },
    }),
  ]);
  // Stok FG OUT
  await Promise.all([
    prisma.inventoryLedger.create({
      data: { tenantId: tenant.id, 
        productId:    fgFullArabica.id,
        entryType:    "OUT",
        refType:      "SALE_FG_OUT",
        refId:        inv1.id,
        quantityUnit: 2,
        notes:        `Penjualan ${inv1.code}`,
        createdById:  systemUser.id,
        createdAt:    daysAgo(1),
      },
    }),
    prisma.inventoryLedger.create({
      data: { tenantId: tenant.id, 
        productId:    fgBlendA.id,
        entryType:    "OUT",
        refType:      "SALE_FG_OUT",
        refId:        inv1.id,
        quantityUnit: 2,
        notes:        `Penjualan ${inv1.code}`,
        createdById:  systemUser.id,
        createdAt:    daysAgo(1),
      },
    }),
  ]);
  // Payment CASH
  await prisma.payment.create({
    data: { tenantId: tenant.id, 
      code:        "PAY-202507-001",
      invoiceId:   inv1.id,
      amount:      760_000,
      method:      "CASH",
      paidAt:      daysAgo(1),
      notes:       "Lunas tunai",
      createdById: systemUser.id,
      createdAt:   daysAgo(1),
    },
  });
  console.log("✓  Invoice LUNAS Kafe A Rp 760.000 — INV-202507-001");

  // ─────────────────────────────────────────────────────────────────────────
  // 16. INVOICE 2 — Kafe B: TEMPO (belum bayar)
  //     1 Full Arabica @ Rp 200.000 = 200.000
  //     Due: +30 hari
  // ─────────────────────────────────────────────────────────────────────────

  const inv2 = await prisma.invoice.create({
    data: { tenantId: tenant.id, 
      code:        "INV-202507-002",
      customerId:  custB.id,
      subtotal:    200_000,
      discount:    0,
      tax:         0,
      grandTotal:  200_000,
      paidAmount:  0,
      status:      "ISSUED",
      issuedAt:    daysAgo(1),
      dueDate:     daysFromNow(30),
      notes:       "Pengiriman ke Bandung — tempo 30 hari",
      createdById: systemUser.id,
      createdAt:   daysAgo(1),
    },
  });
  await prisma.invoiceItem.create({
    data: { tenantId: tenant.id, invoiceId: inv2.id,
      productId: fgFullArabica.id,
      quantity:  1,
      unitPrice: 200_000,
      discount:  0,
      subtotal:  200_000,
      hpp:       122_647,
    },
  });
  await prisma.inventoryLedger.create({
    data: { tenantId: tenant.id, 
      productId:    fgFullArabica.id,
      entryType:    "OUT",
      refType:      "SALE_FG_OUT",
      refId:        inv2.id,
      quantityUnit: 1,
      notes:        `Penjualan ${inv2.code}`,
      createdById:  systemUser.id,
      createdAt:    daysAgo(1),
    },
  });
  console.log("✓  Invoice TEMPO Kafe B Rp 200.000 — INV-202507-002");

  // ─────────────────────────────────────────────────────────────────────────
  // 17. INVOICE 3 — Kafe C: TEMPO (belum bayar)
  //     2 Blend A @ Rp 180.000 = 360.000
  //     Due: +14 hari
  // ─────────────────────────────────────────────────────────────────────────

  const inv3 = await prisma.invoice.create({
    data: { tenantId: tenant.id, 
      code:        "INV-202507-003",
      customerId:  custC.id,
      subtotal:    360_000,
      discount:    0,
      tax:         0,
      grandTotal:  360_000,
      paidAmount:  0,
      status:      "ISSUED",
      issuedAt:    daysAgo(1),
      dueDate:     daysFromNow(14),
      notes:       "Pengiriman ke Surabaya — tempo 14 hari",
      createdById: systemUser.id,
      createdAt:   daysAgo(1),
    },
  });
  await prisma.invoiceItem.create({
    data: { tenantId: tenant.id, invoiceId: inv3.id,
      productId: fgBlendA.id,
      quantity:  2,
      unitPrice: 180_000,
      discount:  0,
      subtotal:  360_000,
      hpp:       109_801,
    },
  });
  await prisma.inventoryLedger.create({
    data: { tenantId: tenant.id, 
      productId:    fgBlendA.id,
      entryType:    "OUT",
      refType:      "SALE_FG_OUT",
      refId:        inv3.id,
      quantityUnit: 2,
      notes:        `Penjualan ${inv3.code}`,
      createdById:  systemUser.id,
      createdAt:    daysAgo(1),
    },
  });
  console.log("✓  Invoice TEMPO Kafe C Rp 360.000 — INV-202507-003");

  // ─────────────────────────────────────────────────────────────────────────
  // 18. PEMBAYARAN PIUTANG — Kafe B lunas via Transfer BCA
  //     Nominal: 200.000 → Invoice INV-202507-002 menjadi PAID
  // ─────────────────────────────────────────────────────────────────────────

  await prisma.payment.create({
    data: { tenantId: tenant.id, 
      code:        "PAY-202507-002",
      invoiceId:   inv2.id,
      amount:      200_000,
      method:      "TRANSFER",
      reference:   "BCA / REF-KC2025-07030001",
      paidAt:      new Date(),   // hari ini
      notes:       "Transfer BCA dari Kafe B — konfirmasi WA",
      createdById: systemUser.id,
    },
  });
  // Update Invoice status → PAID
  await prisma.invoice.update({
    where: { id: inv2.id },
    data: { tenantId: tenant.id,  paidAmount: 200_000, status: "PAID" },
  });
  console.log("✓  Pembayaran Piutang Kafe B Rp 200.000 Transfer BCA — PAY-202507-002");

  // ─────────────────────────────────────────────────────────────────────────
  // RINGKASAN STOK AKHIR (informatif)
  // ─────────────────────────────────────────────────────────────────────────

  console.log("\n" + "─".repeat(60));
  console.log("📊  STOK AKHIR SETELAH SEED");
  console.log("─".repeat(60));
  console.log("  Green Bean:");
  console.log("    • Gayo Mentah    : 0 kg   (10 masuk → 10 roasting)");
  console.log("    • Robusta Mentah : 0 kg   (10 masuk → 10 roasting)");
  console.log("  Roasted Bean:");
  console.log("    • RB Gayo        : 1.0 kg (8.5 masuk → 5+2.5 produksi)");
  console.log("    • RB Robusta     : 6.2 kg (8.7 masuk → 2.5 produksi)");
  console.log("  Finished Goods:");
  console.log("    • Full Arabica   : 2 unit (5 masuk → 2+1 jual)");
  console.log("    • Blend A        : 1 unit (5 masuk → 2+2 jual)");
  console.log("  Packaging:");
  console.log("    • Pouch 1KG      : 40 pcs (50 masuk → 5+5 produksi)");
  console.log("─".repeat(60));
  console.log("💰  PIUTANG OUTSTANDING:");
  console.log("    • Kafe C  INV-202507-003  Rp 360.000  jatuh tempo +14h");
  console.log("─".repeat(60));
  console.log("\n✅  Seed selesai!\n");
}

// =============================================================================
// RUN
// =============================================================================

main()
  .catch((e) => {
    console.error("\n❌  Seed gagal:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
