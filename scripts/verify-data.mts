import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString: connectionString || "" });
const prisma = new PrismaClient({ adapter });

async function verify() {
  const tenant = await prisma.tenant.findFirst({ where: { subdomain: "kimaise" } });
  if (!tenant) throw new Error("Tenant KIMAISE not found");

  console.log("=== INVENTORY LEDGER ===");
  const ledger = await prisma.inventoryLedger.groupBy({
    by: ["productId"],
    where: { tenantId: tenant.id },
    _sum: { quantityKg: true, quantityUnit: true },
  });
  
  for (const l of ledger) {
    if (!l.productId) continue;
    const product = await prisma.product.findUnique({ where: { id: l.productId } });
    console.log(`Product: ${product?.name} | Qty (Kg): ${l._sum.quantityKg || 0} | Qty (Unit): ${l._sum.quantityUnit || 0}`);
  }

  console.log("\n=== ACCOUNTING (Journal Entries) ===");
  const journalEntries = await prisma.journalEntry.findMany({
    where: { tenantId: tenant.id },
    orderBy: { transactionDate: "asc" },
  });
  
  let totalDebit = 0;
  let totalCredit = 0;
  for (const je of journalEntries) {
    totalDebit += Number(je.debit);
    totalCredit += Number(je.credit);
    console.log(`[${je.transactionDate.toISOString().split("T")[0]}] ${je.accountId} | Dr: ${je.debit} | Cr: ${je.credit} | Ref: ${je.reference}`);
  }
  console.log(`Total Debit: ${totalDebit} | Total Credit: ${totalCredit}`);
  console.log(`Accounting Balanced? ${totalDebit === totalCredit}`);

  console.log("\n=== ACCOUNTS SUMMARY ===");
  const accounts = await prisma.account.findMany({ where: { tenantId: tenant.id } });
  
  for (const acc of accounts) {
    const entries = await prisma.journalEntry.findMany({ where: { accountId: acc.id } });
    const dr = entries.reduce((sum, e) => sum + Number(e.debit), 0);
    const cr = entries.reduce((sum, e) => sum + Number(e.credit), 0);
    
    // Calculate balance based on account type
    let balance = 0;
    if (["ASSET", "EXPENSE"].includes(acc.type)) {
      balance = dr - cr;
    } else {
      balance = cr - dr;
    }
    console.log(`${acc.name} (${acc.type}) | Balance: ${balance}`);
  }

  console.log("\n=== INVOICES ===");
  const invoices = await prisma.invoice.findMany({
    where: { tenantId: tenant.id },
    select: { code: true, grandTotal: true, status: true, fulfillmentStatus: true },
  });
  for (const inv of invoices) {
    console.log(`Invoice ${inv.code} | Total: ${inv.grandTotal} | Payment: ${inv.status} | Fulfillment: ${inv.fulfillmentStatus}`);
  }

  await prisma.$disconnect();
}

verify().catch(console.error);
