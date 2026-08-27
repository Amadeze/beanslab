import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Migrasi modal tenant ke CapitalTransaction...");

  const tenants = await prisma.tenant.findMany({
    select: { id: true, code: true, name: true, ownerCapital: true, initialCash: true, createdAt: true },
  });

  for (const tenant of tenants) {
    const ownerCapital = Number(tenant.ownerCapital);
    const initialCash = Number(tenant.initialCash);

    if (ownerCapital <= 0 && initialCash <= 0) {
      console.log(`  ⏭  ${tenant.code} (${tenant.name}): tidak ada modal tercatat`);
      continue;
    }

    // Cek apakah sudah ada CapitalTransaction INITIAL untuk tenant ini
    const existingInitial = await prisma.capitalTransaction.findFirst({
      where: { tenantId: tenant.id, type: "INITIAL" },
    });

    if (existingInitial) {
      console.log(`  ⏭  ${tenant.code} (${tenant.name}): sudah ada transaksi INITIAL`);
      continue;
    }

    // Cari user pertama tenant ini sebagai createdBy
    const firstUser = await prisma.user.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    if (!firstUser) {
      console.log(`  ⚠  ${tenant.code} (${tenant.name}): tidak ada user, skip`);
      continue;
    }

    // Buat CapitalTransaction untuk modal awal
    if (ownerCapital > 0) {
      await prisma.capitalTransaction.create({
        data: {
          tenantId: tenant.id,
          type: "INITIAL",
          amount: ownerCapital,
          description: `Setoran modal awal (${initialCash > 0 ? `Rp${initialCash.toLocaleString("id-ID")} sebagai saldo kas awal` : "awal"})`,
          transactionDate: tenant.createdAt,
          createdById: firstUser.id,
        },
      });
      console.log(`  ✅ ${tenant.code}: modal awal Rp${ownerCapital.toLocaleString("id-ID")}`);
    }
  }

  console.log("\n✅ Migrasi modal selesai!");
}

main()
  .catch((e) => {
    console.error("Gagal migrasi modal:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
