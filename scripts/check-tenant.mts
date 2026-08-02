import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getTenantAccessState } from "../src/lib/subscription";

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function check() {
  const t = await prisma.tenant.findUnique({where: {code: 'KIMAISE'}});
  console.log("Tenant:", t?.subdomain, "isActive:", t?.isActive, "status:", t?.subscriptionStatus, "trial:", t?.trialEndsAt, "access:", t ? getTenantAccessState(t as any) : null);
}
check().finally(() => prisma.$disconnect());
