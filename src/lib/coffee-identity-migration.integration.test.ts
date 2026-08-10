import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { resolveTestDatabaseUrl } from "../../test/setup/test-database-guard";

const integrationEnabled = process.env.RUN_INTEGRATION === "true";
const suite = integrationEnabled ? describe : describe.skip;

const MIGRATION_PATH = join(
  process.cwd(),
  "prisma/migrations/20260810160000_add_coffee_identity/migration.sql",
);

suite("coffee identity migration backfill — real PostgreSQL (TEST_DATABASE_URL)", () => {
  let pool: Pool;
  let schema: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: resolveTestDatabaseUrl(), max: 5 });
    schema = `mig_backfill_${randomUUID().replaceAll("-", "")}`;
    const migrationSql = readFileSync(MIGRATION_PATH, "utf8");

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