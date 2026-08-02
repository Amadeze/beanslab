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
  const users = await prisma.user.findMany({
    include: { tenant: true }
  });
  
  const emailsToKeep = ['evm.dama26@gmail.com', 'rahmat.aryanto26@gmail.com'];
  const usersToDelete = users.filter(u => !emailsToKeep.includes(u.email));
  const usersToKeep = users.filter(u => emailsToKeep.includes(u.email));
  
  console.log("Users to keep:", usersToKeep.map(u => `${u.email} (${u.tenant.code})`));
  console.log("Users to delete:", usersToDelete.length);
  
  const tenants = await prisma.tenant.findMany({
    include: { _count: { select: { users: true } } }
  });
  
  // Find tenants that will have 0 users after deletion
  const tenantIdsWithKeepUsers = new Set(usersToKeep.map(u => u.tenantId));
  const tenantsToDelete = tenants.filter(t => !tenantIdsWithKeepUsers.has(t.id));
  
  console.log("Tenants to delete because they will have no users:");
  console.table(tenantsToDelete.map(t => ({ code: t.code, name: t.name })));
}

main().finally(() => prisma.$disconnect());
