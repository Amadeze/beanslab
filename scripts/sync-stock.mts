import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString: connectionString || "" });
const prisma = new PrismaClient({ adapter });

async function syncStock() {
  console.log("Syncing stock between InventoryLedger and Product/Packaging tables...");
  
  // 1. Get all products and packagings
  const products = await prisma.product.findMany();
  const packagings = await prisma.packaging.findMany();

  // 2. Aggregate InventoryLedger for each product
  for (const product of products) {
    const IN = await prisma.inventoryLedger.aggregate({
      where: { productId: product.id, entryType: "IN" },
      _sum: { quantityKg: true, quantityUnit: true }
    });
    const OUT = await prisma.inventoryLedger.aggregate({
      where: { productId: product.id, entryType: "OUT" },
      _sum: { quantityKg: true, quantityUnit: true }
    });

    const netKg = Number(IN._sum.quantityKg || 0) - Number(OUT._sum.quantityKg || 0);
    const netUnit = Number(IN._sum.quantityUnit || 0) - Number(OUT._sum.quantityUnit || 0);

    await prisma.product.update({
      where: { id: product.id },
      data: {
        stockKg: netKg,
        stockUnit: netUnit
      }
    });
    console.log(`Synced Product ${product.name} | Kg: ${netKg} | Unit: ${netUnit}`);
  }

  // 3. Aggregate InventoryLedger for each packaging
  for (const pkg of packagings) {
    const IN = await prisma.inventoryLedger.aggregate({
      where: { packagingId: pkg.id, entryType: "IN" },
      _sum: { quantityUnit: true }
    });
    const OUT = await prisma.inventoryLedger.aggregate({
      where: { packagingId: pkg.id, entryType: "OUT" },
      _sum: { quantityUnit: true }
    });

    const netUnit = Number(IN._sum.quantityUnit || 0) - Number(OUT._sum.quantityUnit || 0);

    await prisma.packaging.update({
      where: { id: pkg.id },
      data: { stockUnit: netUnit }
    });
    console.log(`Synced Packaging ${pkg.name} | Unit: ${netUnit}`);
  }

  console.log("✅ Stock sync complete.");
}

syncStock()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
