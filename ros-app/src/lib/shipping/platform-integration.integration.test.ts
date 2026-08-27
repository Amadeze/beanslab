import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { resolveTestDatabaseUrl } from "../../../test/setup/test-database-guard";
import { decryptCredential } from "@/lib/credentials";
import {
  getRajaOngkirIntegrationState,
  maskApiKey,
  upsertRajaOngkirApiKey,
} from "./platform-integration";

const integrationEnabled = process.env.RUN_INTEGRATION === "true";
const suite = integrationEnabled ? describe : describe.skip;

const PLAINTEXT = "TEST_SECRET_RAJAONGKIR_123";

suite("platform integration — DB at-rest + uniqueness", () => {
  let client: PrismaClient;
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: resolveTestDatabaseUrl(), max: 5 });
    client = new PrismaClient({ adapter: new PrismaPg(pool) });
    await client.$connect();
    await client.platformIntegration.deleteMany({ where: { provider: "RAJAONGKIR" } });
  });

  afterAll(async () => {
    await client?.platformIntegration.deleteMany({ where: { provider: "RAJAONGKIR" } });
    await client?.$disconnect();
    await pool?.end();
  });

  it("stores the API key encrypted at rest (never plaintext)", async () => {
    await upsertRajaOngkirApiKey(PLAINTEXT);

    const row = await client.platformIntegration.findUniqueOrThrow({
      where: { provider: "RAJAONGKIR" },
    });

    // Stored value must NOT equal the plaintext and must NOT contain it.
    expect(row.encryptedApiKey).not.toBe(PLAINTEXT);
    expect(row.encryptedApiKey).not.toContain(PLAINTEXT);
    expect(row.encryptedApiKey).toMatch(/^enc:v1:/);

    // Decrypt server-side returns the original.
    expect(decryptCredential(row.encryptedApiKey)).toBe(PLAINTEXT);

    // State getter returns only a masked value, never encrypted payload/plaintext.
    const state = await getRajaOngkirIntegrationState();
    expect(state.maskedKey).toBe(maskApiKey(PLAINTEXT));
    expect(state.maskedKey).not.toBe(PLAINTEXT);
    expect(state.maskedKey).not.toBe(row.encryptedApiKey);
    expect(state.maskedKey).toContain("•");
  });

  it("repeated save updates the same record (no duplicate RajaOngkir config)", async () => {
    await upsertRajaOngkirApiKey("FIRST_KEY_VALUE");
    await upsertRajaOngkirApiKey("SECOND_KEY_VALUE");

    const rows = await client.platformIntegration.findMany({
      where: { provider: "RAJAONGKIR" },
    });
    expect(rows).toHaveLength(1);
    expect(decryptCredential(rows[0].encryptedApiKey)).toBe("SECOND_KEY_VALUE");
  });
});
