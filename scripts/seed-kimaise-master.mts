import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function seed() {
  const tenant = await prisma.tenant.findUniqueOrThrow({where: {code: 'KIMAISE'}});
  
  await prisma.supplier.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "SUP-202507-001" } },
    update: {},
    create: { tenantId: tenant.id, code: "SUP-202507-001", name: "Petani Gayo", isActive: true }
  });

  await prisma.product.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "GB-GAYO" } },
    update: {},
    create: { tenantId: tenant.id, code: "GB-GAYO", name: "Green Bean Gayo", type: "GREEN_BEAN", price: 100000, isActive: true }
  });

  await prisma.packaging.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "PKG-POUCH-1KG" } },
    update: {},
    create: { tenantId: tenant.id, code: "PKG-POUCH-1KG", name: "Pouch 1Kg", weightGrams: 10, costPerUnit: 1500, isActive: true }
  });

  await prisma.product.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "RB-GAYO" } },
    update: {},
    create: { tenantId: tenant.id, code: "RB-GAYO", name: "Roasted Bean Gayo", type: "ROASTED_BEAN", price: 150000, isActive: true }
  });

  await prisma.product.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "FG-FULL-ARABICA" } },
    update: {},
    create: { tenantId: tenant.id, code: "FG-FULL-ARABICA", name: "Full Arabica Blend", type: "FINISHED_GOODS", price: 200000, isActive: true }
  });

  await prisma.customer.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "CST-202507-003" } },
    update: {},
    create: { tenantId: tenant.id, code: "CST-202507-003", name: "Kafe Pelanggan C", isActive: true }
  });

  console.log("KIMAISE Master Data seeded!");
}
seed().finally(() => prisma.$disconnect());
