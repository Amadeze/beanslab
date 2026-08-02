import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL is required.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  console.log("Memulai proses penghapusan sisa User dan Tenant...");

  const emailsToKeep = ['evm.dama26@gmail.com', 'rahmat.aryanto26@gmail.com'];

  // Hapus semua user kecuali 2 email di atas
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      email: {
        notIn: emailsToKeep
      }
    }
  });
  console.log(`Berhasil menghapus ${deletedUsers.count} akun User.`);

  // Dapatkan sisa user untuk mengetahui Tenant mana yang harus dipertahankan
  const remainingUsers = await prisma.user.findMany({
    select: { tenantId: true }
  });

  const tenantIdsToKeep = remainingUsers.map(u => u.tenantId);

  // Hapus semua tenant kecuali tenantIdsToKeep
  const deletedTenants = await prisma.tenant.deleteMany({
    where: {
      id: {
        notIn: tenantIdsToKeep
      }
    }
  });
  console.log(`Berhasil menghapus ${deletedTenants.count} Tenant.`);

  // Konfirmasi sisa data
  const finalTenants = await prisma.tenant.findMany({
    select: { code: true, name: true }
  });
  const finalUsers = await prisma.user.findMany({
    select: { email: true, role: true }
  });

  console.log("\n--- STATUS FINAL ---");
  console.log("Tenant yang tersisa:");
  console.table(finalTenants);
  console.log("User yang tersisa:");
  console.table(finalUsers);
}

main()
  .catch(e => {
    console.error("Terjadi kesalahan:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
