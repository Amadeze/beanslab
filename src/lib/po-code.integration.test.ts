import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { createDraftPO, receivePO, sendPO } from "@/lib/po-lite";
import { createProduct } from "@/app/(dashboard)/master-data/actions";

// Gated integration test: only runs against an isolated test DB with RUN_INTEGRATION=true.
const integrationEnabled = process.env.RUN_INTEGRATION === "true";
const suite = integrationEnabled ? describe : describe.skip;

const TENANT_A = "tenant-code-a";
const TENANT_B = "tenant-code-b";
const USER_A = "user-tenant-code-a";
const USER_B = "user-tenant-code-b";

const authState = vi.hoisted(() => ({ tenantId: "tenant-code-a" }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/auth", async () => {
  const { prisma } = await import("@/lib/prisma");
  return {
    requireRole: vi.fn(async () => ({
      id: `user-${authState.tenantId}`,
      tenantId: authState.tenantId,
      role: "OWNER" as const,
    })),
    requireTenantPrisma: vi.fn(async () => prisma),
    getCurrentTenantId: vi.fn(async () => authState.tenantId),
    getSystemUserId: vi.fn(async () => `user-${authState.tenantId}`),
  };
});

suite("business code generators under concurrency (integration)", () => {
  let supplierA = "";
  let supplierB = "";
  let gbA = "";
  let gbB = "";
  let packagingA = "";
  let rbA = "";

  beforeAll(async () => {
    for (const [id, code, subdomain] of [
      [TENANT_A, "CODA", "code-a"],
      [TENANT_B, "CODB", "code-b"],
    ] as const) {
      await prisma.tenant.upsert({
        where: { id },
        create: {
          id,
          code,
          name: `Code Tenant ${code}`,
          subdomain,
          subscriptionTier: "BASIC",
          subscriptionStatus: "ACTIVE",
          isActive: true,
        },
        update: {},
      });
    }
    await prisma.user.upsert({
      where: { id: USER_A },
      create: { id: USER_A, email: "code-a@example.com", name: "Code Owner A", tenantId: TENANT_A, role: "OWNER" },
      update: {},
    });
    await prisma.user.upsert({
      where: { id: USER_B },
      create: { id: USER_B, email: "code-b@example.com", name: "Code Owner B", tenantId: TENANT_B, role: "OWNER" },
      update: {},
    });

    const supA = await prisma.supplier.create({
      data: { tenantId: TENANT_A, code: "SUP-CODA-001", name: "Supplier A", isActive: true },
    });
    supplierA = supA.id;
    const supB = await prisma.supplier.create({
      data: { tenantId: TENANT_B, code: "SUP-CODB-001", name: "Supplier B", isActive: true },
    });
    supplierB = supB.id;

    const gb = await prisma.product.create({
      data: {
        tenantId: TENANT_A,
        code: "GB-CODA-001",
        name: "Green Bean A",
        type: "GREEN_BEAN",
        isActive: true,
      },
    });
    gbA = gb.id;
    const gb2 = await prisma.product.create({
      data: {
        tenantId: TENANT_B,
        code: "GB-CODB-001",
        name: "Green Bean B",
        type: "GREEN_BEAN",
        isActive: true,
      },
    });
    gbB = gb2.id;

    const pkg = await prisma.packaging.create({
      data: { tenantId: TENANT_A, code: "PKG-CODA-001", name: "Kemasan A", weightGrams: 250, costPerUnit: 1000, isActive: true },
    });
    packagingA = pkg.id;
    const rb = await prisma.product.create({
      data: {
        tenantId: TENANT_A,
        code: "RB-CODA-001",
        name: "Roasted Bean A",
        type: "ROASTED_BEAN",
        roastLevel: "MEDIUM",
        isActive: true,
      },
    });
    rbA = rb.id;
  });

  afterAll(async () => {
    for (const tenantId of [TENANT_A, TENANT_B]) {
      await prisma.journalLine.deleteMany({ where: { journalEntry: { tenantId } } });
      await prisma.journalEntry.deleteMany({ where: { tenantId } });
      await prisma.account.deleteMany({ where: { tenantId } });
      await prisma.recipeItem.deleteMany({ where: { tenantId } });
      await prisma.recipe.deleteMany({ where: { tenantId } });
      await prisma.inventoryLedger.deleteMany({ where: { tenantId } });
      await prisma.lot.deleteMany({ where: { tenantId } });
      await prisma.supplierPayment.deleteMany({ where: { tenantId } });
      await prisma.purchase.deleteMany({ where: { tenantId } });
      await prisma.purchaseOrderItem.deleteMany({ where: { tenantId } });
      await prisma.purchaseOrder.deleteMany({ where: { tenantId } });
      await prisma.product.deleteMany({ where: { tenantId } });
      await prisma.packaging.deleteMany({ where: { tenantId } });
      await prisma.supplier.deleteMany({ where: { tenantId } });
    }
    await prisma.user.deleteMany({ where: { id: { in: [USER_A, USER_B] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [TENANT_A, TENANT_B] } } });
  });

  it("creates concurrent draft POs with distinct sequential codes", async () => {
    const N = 6;
    const results = await Promise.all(
      Array.from({ length: N }, () =>
        createDraftPO(
          prisma,
          { supplierId: supplierA, items: [{ productId: gbA, quantity: 5, unitPrice: 10000 }] },
          USER_A,
        ),
      ),
    );

    const codes = results.map((r) => r.code);
    expect(new Set(codes).size).toBe(N);
    expect(codes.every((c) => /^PO-\d{6}-\d{3}$/.test(c))).toBe(true);

    const rows = await prisma.purchaseOrder.findMany({
      where: { id: { in: results.map((r) => r.id) } },
      select: { code: true, tenantId: true },
    });
    expect(rows).toHaveLength(N);
    expect(new Set(rows.map((r) => r.code)).size).toBe(N);
    expect(rows.every((r) => r.tenantId === TENANT_A)).toBe(true);
  });

  it("receives concurrent POs with distinct purchase codes", async () => {
    const N = 4;
    const poIds: string[] = [];
    for (let i = 0; i < N; i += 1) {
      const po = await createDraftPO(
        prisma,
        { supplierId: supplierA, items: [{ productId: gbA, quantity: 10, unitPrice: 10000 }] },
        USER_A,
      );
      poIds.push(po.id);
    }
    await Promise.all(poIds.map((id) => sendPO(prisma, id)));

    const itemIds: string[] = [];
    for (const id of poIds) {
      const item = await prisma.purchaseOrderItem.findFirstOrThrow({
        where: { purchaseOrderId: id },
        select: { id: true },
      });
      itemIds.push(item.id);
    }

    const results = await Promise.all(
      poIds.map((id, index) =>
        receivePO(
          prisma,
          id,
          {
            receivedAt: "2026-08-01",
            paymentMethod: "CREDIT",
            items: [{ poItemId: itemIds[index], receivedQuantity: 10 }],
          },
          USER_A,
        ),
      ),
    );

    const codes = results.flatMap((r) => r.purchaseCodes);
    expect(new Set(codes).size).toBe(N);
    expect(codes.every((c) => /^PUR-\d{6}-\d{3}$/.test(c))).toBe(true);

    const rows = await prisma.purchase.findMany({
      where: { purchaseOrderId: { in: poIds } },
      select: { code: true },
    });
    expect(rows).toHaveLength(N);
    expect(new Set(rows.map((r) => r.code)).size).toBe(N);
  });

  it("creates concurrent FG products with recipes and distinct FG/RCP codes", async () => {
    authState.tenantId = TENANT_A;
    const N = 4;
    const results = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        createProduct({
          name: `FG Concurrency ${i}`,
          type: "FINISHED_GOODS",
          price: 50_000,
          recipe: {
            packagingId: packagingA,
            outputGrams: 1000,
            items: [{ rbProductId: rbA, gramsPerUnit: 250 }],
          },
        }),
      ),
    );

    expect(results.every((r) => r.success)).toBe(true);
    const codes = results.map((r) => (r.success ? r.code : ""));
    expect(new Set(codes).size).toBe(N);
    expect(codes.every((c) => /^FG-\d{3}$/.test(c))).toBe(true);

    const recipes = await prisma.recipe.findMany({
      where: { tenantId: TENANT_A, name: { startsWith: "FG Concurrency" } },
      select: { code: true },
    });
    expect(recipes).toHaveLength(N);
    expect(new Set(recipes.map((r) => r.code)).size).toBe(N);
    expect(recipes.every((r) => /^RCP-\d{3}$/.test(r.code))).toBe(true);
  });

  it("keeps different tenants isolated under concurrent creates", async () => {
    authState.tenantId = TENANT_A;
    const a = Array.from({ length: 3 }, () =>
      createDraftPO(prisma, { supplierId: supplierA, items: [{ productId: gbA, quantity: 5, unitPrice: 10000 }] }, USER_A),
    );
    const b = Array.from({ length: 3 }, () =>
      createDraftPO(prisma, { supplierId: supplierB, items: [{ productId: gbB, quantity: 5, unitPrice: 10000 }] }, USER_B),
    );
    const results = await Promise.all([...a, ...b]);

    expect(results.every((r) => r.code)).toBe(true);
    const rows = await prisma.purchaseOrder.findMany({
      where: { id: { in: results.map((r) => r.id) } },
      select: { code: true, tenantId: true },
    });
    expect(rows).toHaveLength(6);
    const rowsA = rows.filter((r) => r.tenantId === TENANT_A);
    const rowsB = rows.filter((r) => r.tenantId === TENANT_B);
    expect(rowsA).toHaveLength(3);
    expect(rowsB).toHaveLength(3);
    expect(new Set(rowsA.map((r) => r.code)).size).toBe(3);
    expect(new Set(rowsB.map((r) => r.code)).size).toBe(3);
  });
});
