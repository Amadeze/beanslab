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
  console.log("Memulai proses WIPE DATABASE menggunakan TRUNCATE CASCADE...");
  
  // Ambil semua nama tabel dari schema public
  const tables: Array<{ tablename: string }> = await prisma.$queryRawUnsafe(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  `);

  const tablesToKeep = ["tenants", "portal_themes", "users", "_prisma_migrations"];
  const tablesToTruncate = tables
    .map(t => t.tablename)
    .filter(name => !tablesToKeep.includes(name));

  if (tablesToTruncate.length > 0) {
    const truncateQuery = `TRUNCATE TABLE ${tablesToTruncate.map(t => `"${t}"`).join(", ")} CASCADE;`;
    console.log(`Menjalankan TRUNCATE pada ${tablesToTruncate.length} tabel...`);
    await prisma.$executeRawUnsafe(truncateQuery);
  }

  console.log("Menghapus akun User (selain SUPERADMIN dan OWNER)...");
  await prisma.user.deleteMany({
    where: {
      role: {
        notIn: ["SUPERADMIN", "OWNER"]
      }
    }
  });

  console.log("Database berhasil di-wipe (hanya Administrator dan konfigurasi Tenant yang tersisa).");
}

main()
  .catch((e) => {
    console.error("Terjadi kesalahan saat wipe database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
