import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL is required.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function wipe() {
  const tenant = await prisma.tenant.findFirst({ where: { subdomain: "kimaise" } });
  if (!tenant) throw new Error("Tenant KIMAISE not found");

  const tenantId = tenant.id;
  console.log(`Wiping transactional data for tenant: ${tenant.name} (${tenantId})`);

  // Delete in reverse dependency order
  const wipeOrder = [
    prisma.fulfillmentTask.deleteMany({ where: { tenantId } }),
    prisma.paymentSubmission.deleteMany({ where: { tenantId } }),
    prisma.paymentNotificationDelivery.deleteMany({ where: { tenantId } }),
    prisma.payment.deleteMany({ where: { tenantId } }),
    prisma.supplierPayment.deleteMany({ where: { tenantId } }),
    prisma.creditNoteItem.deleteMany({ where: { tenantId } }),
    prisma.creditNote.deleteMany({ where: { tenantId } }),
    prisma.invoiceItem.deleteMany({ where: { tenantId } }),
    prisma.invoice.deleteMany({ where: { tenantId } }),
    prisma.journalLine.deleteMany({ where: { journalEntry: { tenantId } } }), // Or where tenantId if exists
    prisma.journalEntry.deleteMany({ where: { tenantId } }),
    prisma.inventoryLedger.deleteMany({ where: { tenantId } }),
    prisma.productionBatch.deleteMany({ where: { tenantId } }),
    prisma.childRoastingBatch.deleteMany({ where: { tenantId } }),
    prisma.parentRoastingBatch.deleteMany({ where: { tenantId } }),
    prisma.purchaseOrderItem.deleteMany({ where: { tenantId } }),
    prisma.purchaseOrder.deleteMany({ where: { tenantId } }),
    prisma.purchase.deleteMany({ where: { tenantId } }),
    prisma.recipeItem.deleteMany({ where: { tenantId } }),
    prisma.recipe.deleteMany({ where: { tenantId } }),
    prisma.sampleUsageComponent.deleteMany({ where: { tenantId } }),
    prisma.stockReservation.deleteMany({ where: { tenantId } }),
    prisma.contractPrice.deleteMany({ where: { tenantId } }),
    prisma.contract.deleteMany({ where: { tenantId } }),
    prisma.tenantPaymentMethod.deleteMany({ where: { tenantId } }),
    prisma.budget.deleteMany({ where: { tenantId } }),
    prisma.sampleUsage.deleteMany({ where: { tenantId } }),
    prisma.cuppingSession.deleteMany({ where: { tenantId } }),
    prisma.lot.deleteMany({ where: { tenantId } }),
    prisma.product.deleteMany({ where: { tenantId } }),
    prisma.packaging.deleteMany({ where: { tenantId } }),
    prisma.customer.deleteMany({ where: { tenantId } }),
    prisma.supplier.deleteMany({ where: { tenantId } }),
    prisma.expense.deleteMany({ where: { tenantId } }),
    prisma.capitalTransaction.deleteMany({ where: { tenantId } }),
    prisma.artisanPairingCode.deleteMany({ where: { tenantId } }),
    prisma.roastdStudio.deleteMany({ where: { tenantId } }),
    prisma.artisanRoastImport.deleteMany({ where: { tenantId } }),
    prisma.roast.deleteMany({ where: { tenantId } }),
    prisma.machine.deleteMany({ where: { tenantId } }),
  ];

  // Execute in sequential order to avoid deadlocks/FK violations if any
  for (const op of wipeOrder) {
    await op;
  }
  
  // Wipe accounts EXCEPT the default system accounts?
  // Actually JournalEntries are deleted, we can leave Accounts intact, or delete them.
  // We'll delete accounts, they will be recreated by onboarding if needed, or by the E2E script.
  // Wait, E2E script does not recreate accounts! Accounts are created during tenant creation.
  // DO NOT DELETE ACCOUNTS!
  
  // Set all accounts balance back to 0 (if cached) or just leave it since it's aggregated from journals.

  console.log("âœ… Wiped transactional data successfully.");
}

wipe()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
