import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Dropping obsolete constraints from inventory_ledger...");
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "inventory_ledger" DROP CONSTRAINT IF EXISTS "inventory_ledger_exactly_one_positive_quantity";`);
    console.log("Dropped inventory_ledger_exactly_one_positive_quantity");
  } catch (e: any) {
    console.error("Error dropping inventory_ledger_exactly_one_positive_quantity:", e.message);
  }

  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "inventory_ledger" DROP CONSTRAINT IF EXISTS "inventory_ledger_exactly_one_target";`);
    console.log("Dropped inventory_ledger_exactly_one_target");
  } catch (e: any) {
    console.error("Error dropping inventory_ledger_exactly_one_target:", e.message);
  }

  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "capital_transactions" DROP CONSTRAINT IF EXISTS "capital_transaction_amount_positive";`);
    console.log("Dropped capital_transaction_amount_positive");
  } catch (e: any) {
    console.error("Error dropping capital_transaction_amount_positive:", e.message);
  }

  console.log("Done.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
