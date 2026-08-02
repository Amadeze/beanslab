import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
prisma.user.findFirst({where: {email: 'evm.dama26@gmail.com'}}).then(u => console.log(u)).finally(() => prisma.$disconnect());
