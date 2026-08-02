import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
Promise.all([
  prisma.purchase.count({where:{tenantId:'cmrrstib5000004jpoqf0yi2j'}}),
  prisma.invoice.count({where:{tenantId:'cmrrstib5000004jpoqf0yi2j'}}),
  prisma.journalEntry.count({where:{tenantId:'cmrrstib5000004jpoqf0yi2j'}})
]).then(console.log).finally(() => prisma.$disconnect());
