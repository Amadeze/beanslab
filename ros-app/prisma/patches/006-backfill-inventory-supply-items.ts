import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../../.env.local") });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import {
  SupplyBackfillCutoverBlockedError,
  backfillSupplyItems,
  runSupplyBackfillCutover,
  validateSupplyBackfill,
} from "../../src/lib/supply-backfill";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
const prisma = new PrismaClient({ adapter });

async function main() {
  const checkOnly = process.argv.includes("--check-only");

  if (checkOnly) {
    console.log("Supply backfill — validation only (no writes)...\n");
    const validation = await validateSupplyBackfill(prisma, (line) => console.log(line));
    if (!validation.ok) {
      for (const issue of validation.issues) {
        console.log(`  ✗ [${issue.code}] ${issue.tenantCode}/${issue.itemCode}: ${issue.message}`);
      }
      process.exitCode = 1;
    } else {
      console.log(
        `✅ Validation passed: ${validation.packagingCount} packaging, ${validation.supplyItemCount} supply item, ${validation.recipeCount} recipe.`,
      );
    }
    return;
  }

  console.log("Supply backfill — run then validate (cutover gate)...\n");
  const { summary, validation } = await runSupplyBackfillCutover(prisma, (line) =>
    console.log(line),
  );
  console.log(
    `✅ Cutover passed: ${validation.packagingCount} packaging, ${validation.supplyItemCount} supply item, ${validation.recipeCount} recipe (created ${summary.supplyItemsCreated}, linked ${summary.recipeLinksCreated}).`,
  );
}

main()
  .catch((e) => {
    if (e instanceof SupplyBackfillCutoverBlockedError) {
      console.error("\n⛔ Cutover blocked by validation:");
      for (const issue of e.issues) {
        console.error(`  ✗ [${issue.code}] ${issue.tenantCode}/${issue.itemCode}: ${issue.message}`);
      }
      process.exitCode = 1;
      return;
    }
    console.error("Gagal backfill:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());