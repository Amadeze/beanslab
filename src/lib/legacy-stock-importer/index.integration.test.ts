import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";

import { normalizeLegacyStockRows } from "./normalizer";
import { validateLegacyStockRows } from "./validator";
import { resolveLegacyStockDryRun } from "./resolver";
import { buildResolverContext } from "./resolver-context";
import type { LegacyStockRawRow, ResolverContext } from "./types";

const integrationEnabled = process.env.RUN_INTEGRATION === "true";
const suite = integrationEnabled ? describe : describe.skip;

const TENANT_A = "tenant-import-a";
const TENANT_B = "tenant-import-b";
const USERS = [`${TENANT_A}-user`, `${TENANT_B}-user`];

const authState = vi.hoisted(() => ({ tenantId: "tenant-import-a" }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(async () => ({
    id: `user-${authState.tenantId}`,
    tenantId: authState.tenantId,
    role: "OWNER" as const,
  })),
  requireTenantPrisma: vi.fn(async () => prisma),
  getCurrentTenantId: vi.fn(async () => authState.tenantId),
}));

async function createTestTenant(tenantId: string, code: string, subdomain: string) {
  await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {},
    create: {
      id: tenantId,
      code,
      name: `Import Test Tenant ${code}`,
      subdomain,
      subscriptionTier: "TRIAL",
      subscriptionStatus: "ACTIVE",
      isActive: true,
    },
  });
  await prisma.user.upsert({
    where: { id: `${tenantId}-user` },
    update: {},
    create: {
      id: `${tenantId}-user`,
      name: `User ${tenantId}`,
      email: `${tenantId}@import-test.local`,
      password: "hashed",
      tenantId,
    },
  });
}

suite("legacy stock dry-run importer (integration)", () => {
  let ctxA: ResolverContext;
  let ctxB: ResolverContext;

  beforeAll(async () => {
    await createTestTenant(TENANT_A, "IMPORTA", "import-a");
    await createTestTenant(TENANT_B, "IMPORTB", "import-b");
    ctxA = buildResolverContext(TENANT_A);
    ctxB = buildResolverContext(TENANT_B);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: USERS } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [TENANT_A, TENANT_B] } } });
  });

  afterEach(async () => {
    await prisma.inventoryLedger.deleteMany({
      where: { tenantId: { in: [TENANT_A, TENANT_B] } },
    });
    await prisma.product.deleteMany({
      where: {
        tenantId: { in: [TENANT_A, TENANT_B] },
        code: { in: ["GB-INT-001", "GB-INT-002", "RB-INT-001", "FG-INT-001"] },
      },
    });
    await prisma.packaging.deleteMany({
      where: {
        tenantId: { in: [TENANT_A, TENANT_B] },
        code: { startsWith: "SUP-INT-" } },
    });
    await prisma.inventorySupplyItem.deleteMany({
      where: {
        tenantId: { in: [TENANT_A, TENANT_B] },
        code: { in: ["SUP-INT-001", "SUP-INT-002", "SUP-INT-003"] },
      },
    });
  });

  // ── Test 1: CREATE — product does not exist yet → CREATE ──
  it("CREATE: resolves a valid GREEN_BEAN row as CREATE when no matching product exists", async () => {
    authState.tenantId = TENANT_A;

    const raw: LegacyStockRawRow[] = [
      {
        type: "GREEN_BEAN",
        code: "GB-INT-001",
        name: "Test Arabica",
        quantity: "25",
        unitCost: "12000",
        origin: "Ethiopia",
      },
    ];

    const normalized = normalizeLegacyStockRows(raw);
    const validated = validateLegacyStockRows(normalized);
    const result = await resolveLegacyStockDryRun(validated, ctxA);

    expect(result.summary.totalRows).toBe(1);
    expect(result.summary.validRows).toBe(1);
    expect(result.summary.createCount).toBe(1);
    expect(result.summary.matchCount).toBe(0);
    expect(result.summary.errorCount).toBe(0);
    expect(result.rows[0].action).toBe("CREATE");
    expect(result.rows[0].matchedEntityId).toBeUndefined();

    // Verify no DB writes occurred (dry-run)
    const product = await prisma.product.findUnique({
      where: { tenantId_code: { tenantId: TENANT_A, code: "GB-INT-001" } },
    });
    expect(product).toBeNull();
  });

  // ── Test 2: MATCH — product exists with same code and type → MATCH ──
  it("MATCH: resolves a valid GREEN_BEAN row as MATCH when existing product exists", async () => {
    authState.tenantId = TENANT_A;

    await prisma.product.create({
      data: {
        tenantId: TENANT_A,
        code: "GB-INT-002",
        name: "Existing Arabica",
        type: "GREEN_BEAN",
        isActive: true,
      },
    });

    const raw: LegacyStockRawRow[] = [
      {
        type: "GREEN_BEAN",
        code: "GB-INT-002",
        name: "Updated Arabica",
        quantity: "50",
        unitCost: "13000",
      },
    ];

    const normalized = normalizeLegacyStockRows(raw);
    const validated = validateLegacyStockRows(normalized);
    const result = await resolveLegacyStockDryRun(validated, ctxA);

    expect(result.summary.matchCount).toBe(1);
    expect(result.rows[0].action).toBe("MATCH");
    expect(result.rows[0].matchedEntityType).toBe("PRODUCT");
    expect(result.rows[0].matchedEntityId).toBeTruthy();
    expect(result.rows[0].matchedEntityCode).toBe("GB-INT-002");
  });

  // ── Test 3: CROSS-TENANT — product exists in tenant A but NOT in tenant B → CREATE for B ──
  it("CROSS-TENANT: does not match product from another tenant (create instead of match)", async () => {
    authState.tenantId = TENANT_A;

    await prisma.product.create({
      data: {
        tenantId: TENANT_A,
        code: "GB-XT-001",
        name: "Tenant A Specific",
        type: "GREEN_BEAN",
        isActive: true,
      },
    });

    const raw: LegacyStockRawRow[] = [
      {
        type: "GREEN_BEAN",
        code: "GB-XT-001",
        name: "Same Code In Tenant B",
        quantity: "10",
        unitCost: "10000",
      },
    ];

    const normalized = normalizeLegacyStockRows(raw);
    const validated = validateLegacyStockRows(normalized);
    const result = await resolveLegacyStockDryRun(validated, ctxB);

    expect(result.rows[0].action).toBe("CREATE");
    expect(result.summary.matchCount).toBe(0);
    expect(result.summary.createCount).toBe(1);

    await prisma.product.deleteMany({
      where: { tenantId: TENANT_A, code: "GB-XT-001" },
    });
  });

  // ── Test 4: CREATE — supply item does not exist → CREATE ──
  it("CREATE: resolves a valid SUPPLY row as CREATE when no matching supply item exists", async () => {
    authState.tenantId = TENANT_A;

    const raw: LegacyStockRawRow[] = [
      {
        type: "SUPPLY",
        code: "SUP-INT-001",
        name: "Test Packaging",
        quantity: "100",
        unitCost: "2000",
        category: "PACKAGING",
        baseUnit: "KG",
        capacityGrams: "250",
        tareWeightGrams: "12",
      },
    ];

    const normalized = normalizeLegacyStockRows(raw);
    const validated = validateLegacyStockRows(normalized);
    const result = await resolveLegacyStockDryRun(validated, ctxA);

    expect(result.summary.createCount).toBe(1);
    expect(result.rows[0].action).toBe("CREATE");

    const supply = await prisma.inventorySupplyItem.findUnique({
      where: {
        tenantId_code: { tenantId: TENANT_A, code: "SUP-INT-001" },
      },
    });
    expect(supply).toBeNull();
  });

  // ── Test 5: ERROR — invalid row (missing category for SUPPLY) → ERROR ──
  it("ERROR: marks invalid rows as ERROR without DB queries", async () => {
    authState.tenantId = TENANT_A;

    const raw: LegacyStockRawRow[] = [
      // SUPPLY without category → validation fails
      {
        type: "SUPPLY",
        code: "SUP-INT-003",
        name: "Invalid Supply",
        quantity: "50",
        unitCost: "300",
        category: "",
        baseUnit: "KG",
      },
    ];

    const normalized = normalizeLegacyStockRows(raw);
    const validated = validateLegacyStockRows(normalized);
    const result = await resolveLegacyStockDryRun(validated, ctxA);

    expect(result.rows[0].action).toBe("ERROR");
    expect(result.summary.errorCount).toBe(1);
    expect(result.rows[0].errors.some((e) => e.field === "category")).toBe(true);
  });
});
