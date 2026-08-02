import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL is required.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(9, 0, 0, 0);
  return d;
}

async function main() {
  console.log("ðŸš€ Memulai Simulasi Lanjutan (All-Aspects E2E)...\n");

  const tenant = await prisma.tenant.findUnique({ where: { code: 'KIMAISE' } });
  if (!tenant) throw new Error("Tenant KIMAISE tidak ditemukan!");

  const evmUser = await prisma.user.findFirst({
    where: { email: 'evm.dama26@gmail.com', tenantId: tenant.id }
  });
  if (!evmUser) throw new Error("User EVM tidak ditemukan!");

  // Ambil Data Master yang sudah ada dari seed sebelumnya
  const supGayo = await prisma.supplier.findFirst({ where: { code: "SUP-202507-001" } });
  const gbGayo = await prisma.product.findFirst({ where: { code: "GB-GAYO" } });
  const rbGayo = await prisma.product.findFirst({ where: { code: "RB-GAYO" } });
  const custC = await prisma.customer.findFirst({ where: { code: "CST-202507-003" } });
  const fgArabica = await prisma.product.findFirst({ where: { code: "FG-FULL-ARABICA" } });

  if (!supGayo || !gbGayo || !rbGayo || !custC || !fgArabica) {
    throw new Error("Master Data dari simulasi sebelumnya tidak lengkap!");
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 1. MACHINE & IOT (Artisan Integration)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log("1. Setup Mesin Roasting & IoT...");
  const ts = Date.now().toString().slice(-6);
  const machine = await prisma.machine.create({
    data: {
      tenantId: tenant.id,
      name: `Probat 5KG ${ts}`,
      capacityKg: 5,
    }
  });

  const roastdStudio = await prisma.roastdStudio.create({
    data: {
      tenantId: tenant.id,
      machineId: machine.id,
      installationId: `INST-${ts}`,
      computerName: "Roastery-PC",
      platform: "Windows",
      appVersion: "1.0.0",
      credentialHash: `hash-${ts}`,
      status: "ONLINE",
    }
  });

  const roastLog = await prisma.roast.create({
    data: {
      tenantId: tenant.id,
      machineId: machine.id,
      title: "Profil Gayo Medium",
      duration: 600,
      chargeTemperature: 200,
      dropTemperature: 215,
      firstCrackStartTime: 480,
      beanTemperatureSeries: [200, 205, 210, 215],
      environmentalTemperatureSeries: [220, 222, 225, 228],
      events: [],
    }
  });

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 2. PURCHASE ORDER & LOT
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log("2. Setup Purchase Order & Lot Traceability...");
  const po = await prisma.purchaseOrder.create({
    data: {
      tenantId: tenant.id,
      code: `PO-202507-${ts}`,
      supplierId: supGayo.id,
      status: "RECEIVED",
      expectedDate: daysAgo(2),
      notes: "PO Tambahan Gayo",
      createdById: evmUser.id
    }
  });

  await prisma.purchaseOrderItem.create({
    data: {
      tenantId: tenant.id,
      purchaseOrderId: po.id,
      productId: gbGayo.id,
      quantity: 5,
      unitPrice: 105_000,
      totalPrice: 525_000,
    }
  });

  const purchase2 = await prisma.purchase.create({
    data: {
      tenantId: tenant.id,
      code: `PUR-202507-${ts}`,
      type: "GREEN_BEAN",
      supplierId: supGayo.id,
      productId: gbGayo.id,
      weightKg: 5,
      pricePerUnit: 105_000,
      totalCost: 525_000,
      status: "COMPLETED",
      paymentStatus: "UNPAID",
      dueDate: new Date(new Date().setDate(new Date().getDate() + 30)),
      purchaseOrderId: po.id,
      createdById: evmUser.id,
    }
  });

  await prisma.inventoryLedger.create({
    data: {
      tenantId: tenant.id,
      productId: gbGayo.id,
      entryType: "IN",
      refType: "PURCHASE_GB",
      refId: purchase2.id,
      quantityKg: 5,
      createdById: evmUser.id,
    }
  });

  const lot = await prisma.lot.create({
    data: {
      tenantId: tenant.id,
      batchCode: `BATCH-A-${ts}`,
      productId: gbGayo.id,
      supplierId: supGayo.id,
      quantityKg: 5,
      notes: "Panen Lot A",
    }
  });

  await prisma.supplierPayment.create({
    data: {
      tenantId: tenant.id,
      code: `SPAY-${ts}`,
      purchaseId: purchase2.id,
      amount: 525_000,
      method: "TRANSFER",
      createdById: evmUser.id,
    }
  });

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 3. ADVANCED ROASTING (Child Batches)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log("3. Setup Advanced Roasting (Child Batches)...");
  const parentRoast = await prisma.parentRoastingBatch.create({
    data: {
      tenantId: tenant.id,
      code: `RST-202507-${ts}`,
      inputProductId: gbGayo.id,
      targetWeightKg: 5,
      outputProductId: rbGayo.id,
      actualOutputKg: 4.2,
      totalShrinkagePercent: 16,
      status: "COMPLETED",
      machineId: machine.id,
      createdById: evmUser.id,
    }
  });

  await prisma.childRoastingBatch.create({
    data: {
      tenantId: tenant.id,
      parentId: parentRoast.id,
      roastId: roastLog.id,
    }
  });
  await prisma.childRoastingBatch.create({
    data: {
      tenantId: tenant.id,
      parentId: parentRoast.id,
      roastId: roastLog.id,
    }
  });

  await prisma.inventoryLedger.create({
    data: { tenantId: tenant.id, productId: gbGayo.id, entryType: "OUT", refType: "ROASTING_GB_OUT", refId: parentRoast.id, quantityKg: 5, createdById: evmUser.id }
  });
  await prisma.inventoryLedger.create({
    data: { tenantId: tenant.id, productId: rbGayo.id, entryType: "IN", refType: "ROASTING_RB_IN", refId: parentRoast.id, quantityKg: 4.2, createdById: evmUser.id }
  });

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 4. QUALITY CONTROL (Cupping & Sampling)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log("4. Setup Cupping Session & Sample Usage...");
  await prisma.cuppingSession.create({
    data: {
      tenantId: tenant.id,
      code: `CUP-${ts}`,
      date: new Date(),
      productId: rbGayo.id,
      evaluatorName: "EVM Taster",
      notes: "Acidity bright, body medium",
    }
  });

  const sampleUsage = await prisma.sampleUsage.create({
    data: {
      tenantId: tenant.id,
      code: `SMP-${ts}`,
      sourceType: "FINISHED_GOODS",
      sourceLabel: "Kopi Gayo Blend",
      packCount: 2,
      totalGrams: 500,
      totalCost: 150000,
      recipient: "Kafe C",
      notes: "Taster gratis",
      status: "COMPLETED",
      createdById: evmUser.id,
    }
  });

  await prisma.sampleUsageComponent.create({
    data: {
      tenantId: tenant.id,
      sampleUsageId: sampleUsage.id,
      productId: rbGayo.id,
      label: "Roast Batch Gayo",
      quantityKg: 0.2,
      unitCost: 150000,
      totalCost: 30000,
    }
  });

  await prisma.inventoryLedger.create({
    data: {
      tenantId: tenant.id,
      productId: rbGayo.id,
      entryType: "OUT",
      refType: "SAMPLE_RB_OUT",
      refId: sampleUsage.id,
      quantityKg: 0.2,
      createdById: evmUser.id,
    }
  });

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 5. B2B WHOLESALE (Contracts, Fulfillment, Reservation)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log("5. Setup B2B Contracts & Fulfillment...");
  const contract = await prisma.contract.create({
    data: {
      tenantId: tenant.id,
      contractNumber: `CTR-CST-C-${ts}`,
      customerId: custC.id,
      startDate: daysAgo(30),
      endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
      isActive: true,
    }
  });

  await prisma.contractPrice.create({
    data: {
      tenant: { connect: { id: tenant.id } },
      contract: { connect: { id: contract.id } },
      product: { connect: { id: fgArabica.id } },
      tierName: "Gold",
      minOrderQty: 50,
      pricePerUnit: 180000,
    }
  });

  const invB2B = await prisma.invoice.create({
    data: {
      tenantId: tenant.id,
      code: `INV-B2B-${ts}`,
      customerId: custC.id,
      subtotal: 360000,
      grandTotal: 360000,
      status: "ISSUED",
      salesChannel: "B2B_DIRECT",
      createdById: evmUser.id,
    }
  });

  const reservation = await prisma.stockReservation.create({
    data: {
      tenantId: tenant.id,
      invoiceId: invB2B.id,
      productId: fgArabica.id,
      quantity: 2,
      status: "CONSUMED",
      expiresAt: new Date(),
    }
  });

  const fulfillment = await prisma.fulfillmentTask.create({
    data: {
      tenantId: tenant.id,
      invoiceId: invB2B.id,
      productId: fgArabica.id,
      requestedQuantity: 2,
      reservedQuantity: 2,
      shortageQuantity: 0,
      status: "COMPLETED",
    }
  });

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 6. RETUR & CREDIT NOTES
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log("6. Setup Retur (Credit Note)...");
  const creditNote = await prisma.creditNote.create({
    data: {
      tenantId: tenant.id,
      code: `CN-${ts}`,
      invoiceId: invB2B.id,
      reason: "Kemasan sobek saat pengiriman",
      total: 180000,
    }
  });

  await prisma.creditNoteItem.create({
    data: {
      tenantId: tenant.id,
      creditNoteId: creditNote.id,
      productId: fgArabica.id,
      quantity: 1,
      unitPrice: 180000,
      subtotal: 180000,
    }
  });

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 7. ACCOUNTING & BUDGETING
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log("7. Setup Akuntansi & Budgeting...");
  
  const accountKas = await prisma.account.create({
    data: { tenantId: tenant.id, code: `101-${ts}`, name: `Kas Utama - ${ts}`, type: "ASSET" }
  });
  const accountBeban = await prisma.account.create({
    data: { tenantId: tenant.id, code: `501-${ts}`, name: `Beban Iklan - ${ts}`, type: "EXPENSE" }
  });
  
  // Budget dihapus karena tidak ada di skema.

  const expense = await prisma.expense.create({
    data: {
      tenantId: tenant.id,
      category: "OPERASIONAL",
      amount: 500_000,
      date: new Date(),
      description: "Bayar Iklan FB Ads",
      createdById: evmUser.id,
    }
  });

  await prisma.journalEntry.create({
    data: {
      tenantId: tenant.id,
      code: `JE-${ts}`,
      date: new Date(),
      description: "Bayar Iklan FB Ads",
      refType: "EXPENSE",
      reference: expense.id,
      createdById: evmUser.id,
      lines: {
        create: [
          { accountId: accountBeban.id, debit: 500_000, credit: 0 },
          { accountId: accountKas.id, debit: 0, credit: 500_000 }
        ]
      }
    }
  });

  await prisma.capitalTransaction.create({
    data: {
      tenantId: tenant.id,
      type: "INJECTION",
      amount: 10_000_000,
      transactionDate: new Date(),
      description: "Suntikan modal tambahan dari owner",
      createdById: evmUser.id,
    }
  });

  console.log("\nâœ… Simulasi Fitur Lanjutan SELESAI!");
}

main()
  .catch(e => {
    console.error("Gagal menjalankan simulasi lanjutan:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
