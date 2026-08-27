import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL is required.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

type ProductDrift = {
  id: string;
  tenantId: string;
  code: string;
  cachedKg: number;
  cachedUnit: number;
  ledgerKg: number;
  ledgerUnit: number;
};

type PackagingDrift = {
  id: string;
  tenantId: string;
  code: string;
  cachedUnit: number;
  ledgerUnit: number;
};

try {
  const productDrift = await prisma.$queryRaw<ProductDrift[]>`
    SELECT
      p.id,
      p."tenantId",
      p.code,
      p."stockKg"::float AS "cachedKg",
      p."stockUnit" AS "cachedUnit",
      COALESCE(SUM(
        CASE WHEN il."entryType" = 'IN'
          THEN il."quantityKg"
          ELSE -il."quantityKg"
        END
      ), 0)::float AS "ledgerKg",
      COALESCE(SUM(
        CASE WHEN il."entryType" = 'IN'
          THEN il."quantityUnit"
          ELSE -il."quantityUnit"
        END
      ), 0)::int AS "ledgerUnit"
    FROM products p
    LEFT JOIN inventory_ledger il ON il."productId" = p.id
    GROUP BY p.id
    HAVING
      p."stockKg" <> COALESCE(SUM(
        CASE WHEN il."entryType" = 'IN'
          THEN il."quantityKg"
          ELSE -il."quantityKg"
        END
      ), 0)
      OR p."stockUnit" <> COALESCE(SUM(
        CASE WHEN il."entryType" = 'IN'
          THEN il."quantityUnit"
          ELSE -il."quantityUnit"
        END
      ), 0)
  `;

  const packagingDrift = await prisma.$queryRaw<PackagingDrift[]>`
    SELECT
      p.id,
      p."tenantId",
      p.code,
      p."stockUnit" AS "cachedUnit",
      COALESCE(SUM(
        CASE WHEN il."entryType" = 'IN'
          THEN il."quantityUnit"
          ELSE -il."quantityUnit"
        END
      ), 0)::int AS "ledgerUnit"
    FROM packagings p
    LEFT JOIN inventory_ledger il ON il."packagingId" = p.id
    GROUP BY p.id
    HAVING p."stockUnit" <> COALESCE(SUM(
      CASE WHEN il."entryType" = 'IN'
        THEN il."quantityUnit"
        ELSE -il."quantityUnit"
      END
    ), 0)
  `;

  console.log(JSON.stringify({ productDrift, packagingDrift }, null, 2));
  if (productDrift.length > 0 || packagingDrift.length > 0) {
    process.exitCode = 1;
  }
} finally {
  await prisma.$disconnect();
}
