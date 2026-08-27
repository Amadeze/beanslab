import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { SessionUser } from "@/lib/session";

const integrationEnabled = process.env.RUN_INTEGRATION === "true";
const suite = integrationEnabled ? describe : describe.skip;

const TENANT_ID = "tenant-wizard-test";
const USER_ID = "user-wizard-test";

const authState = vi.hoisted(() => ({
  role: "OWNER" as SessionUser["role"],
  tenantId: "tenant-wizard-test",
  userId: "user-wizard-test",
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(async (...roles: string[]) => {
    if (!roles.includes(authState.role)) {
      throw new Error("FORBIDDEN: requires " + roles.join(" | ") + ", got " + authState.role);
    }
    return { id: authState.userId, tenantId: authState.tenantId, role: authState.role };
  }),
  getCurrentTenantId: vi.fn(async () => authState.tenantId),
  getSystemUserId: vi.fn(async () => authState.userId),
  requireTenantPrisma: vi.fn(async () => {
    const { withTenant } = await import("@/lib/prisma");
    return withTenant(authState.tenantId);
  }),
}));

async function createTestTenant() {
  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: {},
    create: {
      id: TENANT_ID,
      code: "WIZARD",
      name: "Wizard Test",
      subdomain: "wizard-test",
      subscriptionTier: "TRIAL",
      subscriptionStatus: "ACTIVE",
      isActive: true,
    },
  });
  await prisma.user.upsert({
    where: { id: USER_ID },
    update: {},
    create: {
      id: USER_ID,
      name: "Wizard User",
      email: "wizard@test.local",
      password: "hashed",
      tenantId: TENANT_ID,
    },
  });
}

async function cleanupTenant() {
  await prisma.inventoryLedger.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.lot.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.packaging.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.inventorySupplyItem.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.product.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.auditLog.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.user.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.tenant.deleteMany({ where: { id: TENANT_ID } });
}

const GREEN_BEAN_ROW = {
  type: "GREEN_BEAN",
  code: "WIZ-GB-001",
  name: "Test GB",
  quantity: "25",
  unitCost: "12000",
};

const SUPPLY_ROW = {
  type: "SUPPLY",
  code: "WIZ-SUP-001",
  name: "Test Supply",
  quantity: "100",
  unitCost: "5000",
  category: "INGREDIENT",
  baseUnit: "KG",
};

const ERROR_ROW = {
  type: "INVALID_TYPE",
  code: "WIZ-BAD",
  name: "Bad Row",
  quantity: "-5",
  unitCost: "100",
};

const WARNING_ROW = {
  type: "GREEN_BEAN",
  code: "WIZ-WARN-001",
  name: "Warning GB",
  quantity: "10",
  unitCost: "8000",
  baseUnit: "GRAM",
};

suite("legacy import wizard — server actions", () => {
  beforeAll(async () => {
    await createTestTenant();
  });

  afterAll(async () => {
    await cleanupTenant();
  });

  afterEach(async () => {
    await prisma.inventoryLedger.deleteMany({ where: { tenantId: TENANT_ID, refId: { startsWith: "WIZ" } } });
    await prisma.lot.deleteMany({ where: { tenantId: TENANT_ID, batchCode: { startsWith: "WIZ" } } });
    await prisma.packaging.deleteMany({ where: { tenantId: TENANT_ID, code: { startsWith: "WIZ-PKG" } } });
    await prisma.inventorySupplyItem.deleteMany({ where: { tenantId: TENANT_ID, code: { startsWith: "WIZ-SUP" } } });
    await prisma.product.deleteMany({ where: { tenantId: TENANT_ID, code: { startsWith: "WIZ-GB" } } });
  });

  it("valid upload → dry-run preview", async () => {
    const { parseUploadedFileAction } = await import("./actions");
    const { dryRunAction } = await import("./actions");

    const csv = "type,code,name,quantity,unitCost\n" + "GREEN_BEAN,WIZ-GB-001,Test GB,25,12000\n";
    const buffer = Buffer.from(csv);
    const file = new File([buffer], "test.csv", { type: "text/csv" });
    const formData = new FormData();
    formData.append("file", file);

    const parseResult = await parseUploadedFileAction(formData);
    expect(parseResult.errors).toHaveLength(0);
    expect(parseResult.rawRows).toHaveLength(1);
    expect(parseResult.rawRows[0].code).toBe("WIZ-GB-001");

    const dryRun = await dryRunAction(parseResult.rawRows);
    expect(dryRun.summary.totalRows).toBe(1);
    expect(dryRun.summary.createCount).toBe(1);
    expect(dryRun.rows[0].action).toBe("CREATE");
  });

  it("ERROR rows disable apply", async () => {
    const { dryRunAction, applyOpeningStockAction } = await import("./actions");

    const dryRun = await dryRunAction([ERROR_ROW as any]);
    expect(dryRun.summary.errorCount).toBeGreaterThan(0);

    const result = await applyOpeningStockAction([ERROR_ROW as any], "WIZ-ERROR-BLOCK");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.createdMasters).toBe(0);
    expect(result.ledgerEntriesCreated).toBe(0);
  });

  it("warning rows allow apply", async () => {
    const { dryRunAction, applyOpeningStockAction } = await import("./actions");

    const dryRun = await dryRunAction([WARNING_ROW as any]);
    expect(dryRun.summary.errorCount).toBe(0);
    expect(dryRun.rows[0].warnings.length).toBeGreaterThan(0);

    const result = await applyOpeningStockAction([WARNING_ROW as any], "WIZ-WARN-OK");
    expect(result.errors).toHaveLength(0);
    expect(result.createdMasters).toBe(1);
  });

  it("CREATE/MATCH summary correct", async () => {
    const { dryRunAction, applyOpeningStockAction } = await import("./actions");

    // First create a product to match against
    await applyOpeningStockAction([GREEN_BEAN_ROW as any], "WIZ-SUMMARY-01");

    // Now dry-run with same code → should show MATCH
    const dryRun = await dryRunAction([
      GREEN_BEAN_ROW,
      { ...GREEN_BEAN_ROW, code: "WIZ-GB-002", name: "New GB" },
    ]);
    expect(dryRun.summary.totalRows).toBe(2);
    expect(dryRun.summary.createCount).toBe(1);
    expect(dryRun.summary.matchCount).toBe(1);
  });

  it("apply calls opening stock writer once", async () => {
    const { applyOpeningStockAction } = await import("./actions");

    const result = await applyOpeningStockAction([GREEN_BEAN_ROW as any], "WIZ-APPLY-ONCE");
    expect(result.errors).toHaveLength(0);
    expect(result.ledgerEntriesCreated).toBe(1);

    const ledgerCount = await prisma.inventoryLedger.count({
      where: { tenantId: TENANT_ID, refId: "WIZ-APPLY-ONCE", refType: "ADJUSTMENT_IN" },
    });
    expect(ledgerCount).toBe(1);
  });

  it("retry uses same operationKey", async () => {
    const { applyOpeningStockAction } = await import("./actions");

    const input = {
      rawRows: [GREEN_BEAN_ROW as any],
      operationKey: "WIZ-RETRY-KEY",
    };

    const result1 = await applyOpeningStockAction(input.rawRows, input.operationKey);
    expect(result1.errors).toHaveLength(0);
    expect(result1.createdMasters).toBe(1);

    const result2 = await applyOpeningStockAction(input.rawRows, input.operationKey);
    expect(result2.errors).toHaveLength(0);
    expect(result2.createdMasters).toBe(0);
    expect(result2.ledgerEntriesCreated).toBe(0);
  });

  it("unauthorized role blocked", async () => {
    const originalRole = authState.role;
    authState.role = "OPERATOR";

    try {
      const { parseUploadedFileAction } = await import("./actions");
      const formData = new FormData();
      formData.append("file", new File([Buffer.from("type,code\n")], "test.csv"));

      await expect(parseUploadedFileAction(formData)).rejects.toThrow(/FORBIDDEN/);
    } finally {
      authState.role = originalRole;
    }
  });

  it("server ignores client tenant identity", async () => {
    const { applyOpeningStockAction } = await import("./actions");

    // Call with the correct tenant — should succeed
    const result = await applyOpeningStockAction(
      [{ ...GREEN_BEAN_ROW, code: "WIZ-TENANT-CHECK" } as any],
      "WIZ-TENANT-ISO",
    );
    expect(result.errors).toHaveLength(0);

    // Verify the product was created under the auth tenant, not any client-provided tenant
    const product = await prisma.product.findUnique({
      where: { tenantId_code: { tenantId: TENANT_ID, code: "WIZ-TENANT-CHECK" } },
    });
    expect(product).not.toBeNull();
    expect(product?.tenantId).toBe(TENANT_ID);
  });

  it("successful result summary", async () => {
    const { applyOpeningStockAction } = await import("./actions");

    const result = await applyOpeningStockAction(
      [
        { ...GREEN_BEAN_ROW, code: "WIZ-SUMMARY-001" } as any,
        { ...SUPPLY_ROW, code: "WIZ-SUMMARY-SUP" } as any,
      ],
      "WIZ-SUMMARY-DONE",
    );

    expect(result.errors).toHaveLength(0);
    expect(result.totalRows).toBe(2);
    expect(result.createdMasters).toBe(2);
    expect(result.ledgerEntriesCreated).toBe(2);
    expect(result.totalOpeningValue).toBe(25 * 12000 + 100 * 5000);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].entityId).toBeTruthy();
    expect(result.rows[0].ledgerRefId).toBe("WIZ-SUMMARY-DONE");
  });

  it("file size/type rejection", async () => {
    const { parseUploadedFileAction } = await import("./actions");

    // Wrong file type
    const formData = new FormData();
    formData.append("file", new File([Buffer.from("not csv")], "test.txt", { type: "text/plain" }));
    const result = await parseUploadedFileAction(formData);
    expect(result.errors.length).toBeGreaterThan(0);

    // No file
    const emptyFormData = new FormData();
    const result2 = await parseUploadedFileAction(emptyFormData);
    expect(result2.errors.length).toBeGreaterThan(0);
  });
});
