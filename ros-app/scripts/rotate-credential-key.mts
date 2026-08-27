import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import {
  decryptCredentialWithSecret,
  encryptCredentialWithSecret,
  isEncryptedCredential,
} from "../src/lib/credentials";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
const oldSecret =
  process.env.OLD_CREDENTIAL_ENCRYPTION_KEY || process.env.SESSION_SECRET;
const newSecret = process.env.CREDENTIAL_ENCRYPTION_KEY;

if (!connectionString) throw new Error("DATABASE_URL or DIRECT_URL is required.");
if (!oldSecret) {
  throw new Error("OLD_CREDENTIAL_ENCRYPTION_KEY or SESSION_SECRET is required.");
}
if (!newSecret) throw new Error("CREDENTIAL_ENCRYPTION_KEY is required.");
if (oldSecret === newSecret) throw new Error("Old and new credential keys must differ.");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

try {
  const tenants = await prisma.tenant.findMany({
    where: { midtransServerKey: { not: null } },
    select: { id: true, midtransServerKey: true },
  });

  const rotations = tenants.flatMap((tenant) => {
    const encrypted = tenant.midtransServerKey;
    if (!encrypted || !isEncryptedCredential(encrypted)) return [];
    const plaintext = decryptCredentialWithSecret(encrypted, oldSecret);
    return [{
      id: tenant.id,
      encrypted: encryptCredentialWithSecret(plaintext, newSecret),
    }];
  });

  await prisma.$transaction(
    rotations.map((rotation) =>
      prisma.tenant.update({
        where: { id: rotation.id },
        data: { midtransServerKey: rotation.encrypted },
      }),
    ),
  );

  console.log(JSON.stringify({
    inspected: tenants.length,
    rotated: rotations.length,
  }));
} finally {
  await prisma.$disconnect();
}
