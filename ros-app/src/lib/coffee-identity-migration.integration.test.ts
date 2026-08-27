import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { resolveTestDatabaseUrl } from "../../test/setup/test-database-guard";

const integrationEnabled = process.env.RUN_INTEGRATION === "true";
const suite = integrationEnabled ? describe : describe.skip;

// Fixture: the historical one-time backfill migration
// (20260810160000_add_coffee_identity) that was absorbed into the baseline.
// Fresh deploys no longer execute it (the CoffeeSource table and the
// coffeeSourceId/materialOrigin columns ship with the baseline), but the
// backfill LOGIC is regression-tested here on a disposable schema.
const MIGRATION_SQL = `-- =============================================================================
-- Coffee identity foundation: CoffeeSource + Product.materialOrigin
-- (historical fixture: 20260810160000_add_coffee_identity/migration.sql)
-- =============================================================================

CREATE TYPE "MaterialOrigin" AS ENUM ('INTERNAL_ROAST', 'PURCHASED_ROASTED');

CREATE TABLE "coffee_sources" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "region" TEXT,
    "farm" TEXT,
    "species" TEXT,
    "varietal" TEXT,
    "processMethod" TEXT,
    "fermentationMethod" TEXT,
    "elevation" TEXT,
    "cropYear" TEXT,
    "certifications" TEXT[],
    "tastingNotes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "coffee_sources_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "coffee_sources_tenantId_code_key" ON "coffee_sources"("tenantId", "code");

CREATE INDEX "coffee_sources_tenantId_isActive_idx" ON "coffee_sources"("tenantId", "isActive");

ALTER TABLE "products" ADD COLUMN "coffeeSourceId" TEXT;
ALTER TABLE "products" ADD COLUMN "materialOrigin" "MaterialOrigin";

INSERT INTO "coffee_sources" ("id", "tenantId", "code", "name", "country", "region", "species", "isActive", "createdAt", "updatedAt")
SELECT gb."id", gb."tenantId", gb."code", gb."name", NULL, gb."origin", gb."coffeeSpecies", true, gb."createdAt", gb."createdAt"
FROM "products" gb
WHERE gb."type" = 'GREEN_BEAN'
ORDER BY gb."createdAt", gb."id";

UPDATE "products" gb
SET "coffeeSourceId" = gb."id"
WHERE gb."type" = 'GREEN_BEAN';

UPDATE "products" rb
SET "coffeeSourceId" = rb."sourceGreenBeanId"
WHERE rb."type" = 'ROASTED_BEAN'
  AND rb."sourceGreenBeanId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "products" gb
    WHERE gb."id" = rb."sourceGreenBeanId"
      AND gb."type" = 'GREEN_BEAN'
      AND gb."tenantId" = rb."tenantId"
      AND gb."coffeeSourceId" IS NOT NULL
  );

UPDATE "products" rb
SET "materialOrigin" = 'INTERNAL_ROAST'
WHERE rb."type" = 'ROASTED_BEAN'
  AND rb."sourceGreenBeanId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "products" gb
    WHERE gb."id" = rb."sourceGreenBeanId"
      AND gb."type" = 'GREEN_BEAN'
      AND gb."tenantId" = rb."tenantId"
      AND gb."coffeeSourceId" IS NOT NULL
  );

CREATE INDEX "products_tenantId_coffeeSourceId_idx" ON "products"("tenantId", "coffeeSourceId");

ALTER TABLE "coffee_sources"
ADD CONSTRAINT "coffee_sources_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "products"
ADD CONSTRAINT "products_coffeeSourceId_fkey"
FOREIGN KEY ("coffeeSourceId") REFERENCES "coffee_sources"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
`;

suite("coffee identity migration backfill â€” real PostgreSQL (TEST_DATABASE_URL)", () => {
  let pool: Pool;
  let schema: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: resolveTestDatabaseUrl(), max: 5 });
    schema = `mig_backfill_${randomUUID().replaceAll("-", "")}`;
    const migrationSql = MIGRATION_SQL;

    // Menjalankan migration.sql SESUAI FILE (bukan salinan) di atas schema
    // sementara: scaffolding minimal + seeder skenario legacy, lalu seluruh
    // isi migration.sql dalam satu batch pada satu sesi (search_path
    // menargetkan schema sementara, public tidak tersentuh).
    const batch = `
SET search_path TO "${schema}";
CREATE SCHEMA IF NOT EXISTS "${schema}";

CREATE TABLE "tenants" ("id" TEXT NOT NULL PRIMARY KEY);

CREATE TABLE "products" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "tenants"("id"),
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "coffeeSpecies" TEXT,
  "origin" TEXT,
  "sourceGreenBeanId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "tenants" ("id") VALUES ('tenant-a'), ('tenant-b');

INSERT INTO "products" ("id", "tenantId", "code", "name", "type", "sourceGreenBeanId") VALUES
  ('gb-valid', 'tenant-a', 'GB-VALID-A', 'Valid Gayo A', 'GREEN_BEAN', NULL),
  ('rb-valid', 'tenant-a', 'RB-VALID-A', 'Valid Row A', 'ROASTED_BEAN', 'gb-valid'),
  ('rb-no-lineage', 'tenant-a', 'RB-NO-LINEAGE-A', 'Legacy Row A', 'ROASTED_BEAN', NULL),
  ('fg-other', 'tenant-a', 'FG-OTHER-A', 'Other Product A', 'FINISHED_GOODS', NULL),
  ('rb-non-gb-source', 'tenant-a', 'RB-NON-GB-A', 'Row Referencing Non-GB', 'ROASTED_BEAN', 'fg-other'),
  ('rb-cross-tenant', 'tenant-b', 'RB-CROSS-B', 'Row Referencing Tenant A GB', 'ROASTED_BEAN', 'gb-valid');

${migrationSql}
`;
    await pool.query(batch);
  });

  afterAll(async () => {
    if (pool) {
      await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await pool.end();
    }
  });

  async function productRow(id: string) {
    const result = await pool.query(
      `SELECT "coffeeSourceId", "materialOrigin" FROM "${schema}"."products" WHERE "id" = $1`,
      [id],
    );
    return result.rows[0] as { coffeeSourceId: string | null; materialOrigin: string | null };
  }

  it("links a lineage-proven internal RB to its GB identity as INTERNAL_ROAST", async () => {
    const rb = await productRow("rb-valid");
    expect(rb.coffeeSourceId).toBe("gb-valid");
    expect(rb.materialOrigin).toBe("INTERNAL_ROAST");
  });

  it("keeps RB without lineage unlinked and origin NULL", async () => {
    const rb = await productRow("rb-no-lineage");
    expect(rb.coffeeSourceId).toBeNull();
    expect(rb.materialOrigin).toBeNull();
  });

  it("keeps RB referencing a non-GB product unlinked and origin NULL", async () => {
    const rb = await productRow("rb-non-gb-source");
    expect(rb.coffeeSourceId).toBeNull();
    expect(rb.materialOrigin).toBeNull();
  });

  it("keeps RB referencing another tenant's GB unlinked and origin NULL", async () => {
    const rb = await productRow("rb-cross-tenant");
    expect(rb.coffeeSourceId).toBeNull();
    expect(rb.materialOrigin).toBeNull();
  });

  it("creates one CoffeeSource per existing GREEN_BEAN (id = GB id)", async () => {
    const result = await pool.query(
      `SELECT "id", "tenantId" FROM "${schema}"."coffee_sources" ORDER BY "id"`,
    );
    expect(result.rows.map((row: any) => row.id)).toEqual(["gb-valid"]);
    expect(result.rows[0].tenantId).toBe("tenant-a");
  });

  it("links each GREEN_BEAN to its own identity source", async () => {
    const result = await pool.query(
      `SELECT "coffeeSourceId" FROM "${schema}"."products" WHERE "id" = 'gb-valid'`,
    );
    expect(result.rows[0].coffeeSourceId).toBe("gb-valid");
  });
});
