import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { postPurchase, postSalesInvoice, postJournalEntry } from "../src/lib/posting";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString: connectionString! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { code: 'KIMAISE' } });
  const evmUser = await prisma.user.findFirstOrThrow({
    where: { email: 'evm.dama26@gmail.com', tenantId: tenant.id }
  });

  const options = { tenantId: tenant.id, userId: evmUser.id, tx: prisma };

  // 1. Post Purchases
  const purchases = await prisma.purchase.findMany({ where: { tenantId: tenant.id } });
  for (const purchase of purchases) {
    const supplier = await prisma.supplier.findUnique({ where: { id: purchase.supplierId } });
    if (!supplier) continue;
    
    // Check if JournalEntry exists
    const exists = await prisma.journalEntry.findFirst({ where: { reference: purchase.id } });
    if (exists) continue;

    await postPurchase(
      purchase.id,
      purchase.type,
      Number(purchase.totalCost),
      Number(purchase.paidAmount),
      supplier.name,
      options
    );
    console.log(`Posted Purchase: ${purchase.code}`);
  }

  // 2. Post Invoices
  const invoices = await prisma.invoice.findMany({ where: { tenantId: tenant.id }, include: { items: { include: { product: true } } } });
  for (const invoice of invoices) {
    const customer = await prisma.customer.findUnique({ where: { id: invoice.customerId } });
    if (!customer) continue;

    const exists = await prisma.journalEntry.findFirst({ where: { reference: invoice.id } });
    if (exists) continue;

    const invoiceItems = invoice.items.map(i => ({
      productType: i.product.type,
      hpp: Number(i.unitPrice) * 0.5, // Dummy HPP
      quantity: i.quantity
    }));

    await postSalesInvoice(
      invoice.id,
      Number(invoice.grandTotal),
      Number(invoice.paidAmount),
      customer.name,
      invoiceItems,
      options
    );
    console.log(`Posted Invoice: ${invoice.code}`);
  }

  console.log("Selesai generate akuntansi!");
}

main().finally(() => prisma.$disconnect());
