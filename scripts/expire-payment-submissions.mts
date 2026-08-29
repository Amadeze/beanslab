import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { expirePaymentSubmissions } from "../src/lib/expire-payment-submissions";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL or DIRECT_URL is required.");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

try {
  console.log(JSON.stringify(await expirePaymentSubmissions(prisma), null, 2));
} finally {
  await prisma.$disconnect();
}