import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../../.env.local") });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Posting jurnal untuk transaksi modal yang sudah ada...\n");

  const capitalTxns = await prisma.capitalTransaction.findMany({
    orderBy: { transactionDate: "asc" },
    include: { tenant: { select: { code: true, name: true } } },
  });

  let posted = 0;
  let skipped = 0;

  for (const txn of capitalTxns) {
    const existingJE = await prisma.journalEntry.findFirst({
      where: { reference: txn.id, refType: "CAPITAL" },
    });

    if (existingJE) {
      skipped++;
      continue;
    }

    const amount = Math.abs(Number(txn.amount));
    if (amount <= 0) {
      skipped++;
      continue;
    }

    const isInflow = txn.type === "INITIAL" || txn.type === "INJECTION" || txn.type === "DIVIDEND";
    const desc = txn.description || `Transaksi modal: ${txn.type}`;

    const year = txn.transactionDate.getFullYear();
    const month = String(txn.transactionDate.getMonth() + 1).padStart(2, "0");
    const prefix = `JE-${year}-${month}-`;
    const last = await prisma.journalEntry.findFirst({
      where: { code: { startsWith: prefix }, tenantId: txn.tenantId },
      orderBy: { code: "desc" },
      select: { code: true },
    });
    const seq = last ? (parseInt(last.code.split("-").pop() ?? "0", 10) + 1) : 1;
    const code = `${prefix}${String(seq).padStart(3, "0")}`;

    const cashAccount = await prisma.account.findUnique({
      where: { tenantId_code: { tenantId: txn.tenantId, code: "1-1000" } },
    });
    const equityAccount = isInflow
      ? await prisma.account.findUnique({ where: { tenantId_code: { tenantId: txn.tenantId, code: "3-1000" } } })
      : await prisma.account.findUnique({ where: { tenantId_code: { tenantId: txn.tenantId, code: "3-1010" } } });

    if (!cashAccount || !equityAccount) {
      console.log(`  ⚠  ${txn.tenant.code}: akun tidak ditemukan, skip txn ${txn.id}`);
      skipped++;
      continue;
    }

    await prisma.journalEntry.create({
      data: {
        code,
        date: txn.transactionDate,
        description: desc,
        reference: txn.id,
        refType: "CAPITAL",
        tenantId: txn.tenantId,
        createdById: txn.createdById,
        lines: {
          create: isInflow
            ? [
                { sideId: 0, debit: amount, credit: 0, accountId: cashAccount.id },
                { sideId: 1, debit: 0, credit: amount, accountId: equityAccount.id },
              ]
            : [
                { sideId: 0, debit: amount, credit: 0, accountId: equityAccount.id },
                { sideId: 1, debit: 0, credit: amount, accountId: cashAccount.id },
              ],
        },
      },
    });

    console.log(`  ✅ ${txn.tenant.code}: ${code} — ${desc} (Rp${amount.toLocaleString("id-ID")})`);
    posted++;
  }

  console.log(`\n✅ Selesai: ${posted} jurnal diposting, ${skipped} skipped`);
}

main()
  .catch((e) => {
    console.error("Gagal posting jurnal modal:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
