import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import {
  encryptCredential,
  isEncryptedCredential,
} from "../src/lib/credentials";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL is required.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

try {
  const tenants = await prisma.tenant.findMany({
    where: { midtransServerKey: { not: null } },
    select: { id: true, midtransServerKey: true },
  });

  let encryptedCount = 0;
  for (const tenant of tenants) {
    const value = tenant.midtransServerKey;
    if (!value || isEncryptedCredential(value)) continue;

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { midtransServerKey: encryptCredential(value) },
    });
    encryptedCount += 1;
  }

  console.log(
    JSON.stringify({
      inspected: tenants.length,
      encrypted: encryptedCount,
      alreadyEncrypted: tenants.length - encryptedCount,
    }),
  );
} finally {
  await prisma.$disconnect();
}
