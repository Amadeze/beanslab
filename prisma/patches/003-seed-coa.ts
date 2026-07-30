import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../../.env.local") });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const TEMPLATE = [
  { code: "1-1000", name: "Kas Operasional", type: "ASSET" as const, isSystem: true },
  { code: "1-1010", name: "Bank BCA", type: "ASSET" as const },
  { code: "1-1020", name: "Bank Mandiri", type: "ASSET" as const },
  { code: "1-1100", name: "Piutang Usaha", type: "ASSET" as const, isSystem: true },
  { code: "1-1200", name: "Persediaan Green Bean", type: "ASSET" as const, isSystem: true },
  { code: "1-1210", name: "Persediaan Roasted Bean", type: "ASSET" as const, isSystem: true },
  { code: "1-1220", name: "Persediaan Produk Jadi", type: "ASSET" as const, isSystem: true },
  { code: "1-1230", name: "Persediaan Kemasan", type: "ASSET" as const, isSystem: true },
  { code: "1-1300", name: "Peralatan Produksi", type: "ASSET" as const },
  { code: "1-1310", name: "Akumulasi Penyusutan Peralatan", type: "ASSET" as const },
  { code: "2-1000", name: "Utang Usaha", type: "LIABILITY" as const, isSystem: true },
  { code: "2-1100", name: "Utang Pajak", type: "LIABILITY" as const },
  { code: "2-1200", name: "Utang Bank", type: "LIABILITY" as const },
  { code: "3-1000", name: "Modal Pemilik", type: "EQUITY" as const, isSystem: true },
  { code: "3-1010", name: "Prive / Penarikan Pemilik", type: "EQUITY" as const, isSystem: true },
  { code: "3-1020", name: "Laba Ditahan", type: "EQUITY" as const, isSystem: true },
  { code: "3-1030", name: "Laba Tahun Berjalan", type: "EQUITY" as const, isSystem: true },
  { code: "4-1000", name: "Pendapatan Penjualan Produk Jadi", type: "REVENUE" as const, isSystem: true },
  { code: "4-1010", name: "Pendapatan Penjualan Roasted Bean", type: "REVENUE" as const },
  { code: "4-1020", name: "Pendapatan Lain-lain", type: "REVENUE" as const },
  { code: "5-1000", name: "HPP - Bahan Baku", type: "EXPENSE" as const, isSystem: true },
  { code: "5-1010", name: "HPP - Tenaga Kerja Langsung", type: "EXPENSE" as const, isSystem: true },
  { code: "5-1020", name: "HPP - Overhead Pabrik", type: "EXPENSE" as const, isSystem: true },
  { code: "5-1030", name: "HPP - Kemasan", type: "EXPENSE" as const, isSystem: true },
  { code: "5-2000", name: "Beban Gaji & Tunjangan", type: "EXPENSE" as const },
  { code: "5-2010", name: "Beban Sewa", type: "EXPENSE" as const },
  { code: "5-2020", name: "Beban Utilitas", type: "EXPENSE" as const },
  { code: "5-2030", name: "Beban Operasional", type: "EXPENSE" as const },
  { code: "5-2040", name: "Beban Penyusutan", type: "EXPENSE" as const },
  { code: "5-2050", name: "Beban Pemasaran", type: "EXPENSE" as const },
  { code: "5-2060", name: "Beban Lain-lain", type: "EXPENSE" as const },
];

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding Chart of Accounts untuk semua tenant...\n");

  const tenants = await prisma.tenant.findMany({
    select: { id: true, code: true, name: true },
  });

  for (const tenant of tenants) {
    const existingCount = await prisma.account.count({
      where: { tenantId: tenant.id },
    });

    if (existingCount > 0) {
      console.log(`  ⏭  ${tenant.code} (${tenant.name}): sudah memiliki ${existingCount} akun`);
      continue;
    }

    await prisma.account.createMany({
      data: TEMPLATE.map((a) => ({
        code: a.code,
        name: a.name,
        type: a.type,
        isSystem: a.isSystem ?? false,
        tenantId: tenant.id,
      })),
    });

    console.log(`  ✅ ${tenant.code} (${tenant.name}): ${TEMPLATE.length} akun dibuat`);
  }

  console.log("\n✅ Seeding COA selesai!");
}

main()
  .catch((e) => {
    console.error("Gagal seed COA:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
