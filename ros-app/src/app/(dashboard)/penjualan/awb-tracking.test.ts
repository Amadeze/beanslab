import { describe, expect, it, vi, beforeEach } from "vitest";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const USER_ID = "user-1";
const INVOICE_ID = "inv-1";

// ── Top-level mocks (vitest hoists vi.mock) ────────────────────────────────

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
  requireTenantPrisma: vi.fn(),
  getCurrentTenantId: vi.fn(),
  getSystemUserId: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@prisma/client", () => {
  const JsonNull = Symbol("Prisma.JsonNull");
  return { Prisma: { JsonNull } };
});

vi.mock("@/lib/shipping/platform-integration", () => ({
  getRajaOngkirClientConfig: vi.fn(),
}));

vi.mock("@/lib/shipping/providers/rajaongkir", () => ({
  trackWaybillDetailed: vi.fn(),
}));

vi.mock("@/lib/shipping/tracking", () => ({
  normalizeTrackingResponse: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────────────────

const {
  requireTenantPrisma,
  getCurrentTenantId,
  getSystemUserId,
  requireRole,
} = await import("@/lib/auth");
const { recordAudit } = await import("@/lib/audit");
const { getRajaOngkirClientConfig } = await import(
  "@/lib/shipping/platform-integration"
);
const { trackWaybillDetailed } = await import(
  "@/lib/shipping/providers/rajaongkir"
);
const { normalizeTrackingResponse } = await import("@/lib/shipping/tracking");

// ── Helpers ────────────────────────────────────────────────────────────────

function buildInvoice(overrides: Record<string, any> = {}) {
  return {
    id: INVOICE_ID,
    tenantId: TENANT_A,
    shippingMethod: "COURIER",
    shippingCourierCode: "jne",
    courierName: "JNE",
    trackingNumber: null,
    status: "PAID",
    fulfillmentStatus: "SHIPPED",
    ...overrides,
  };
}

function buildTracking(overrides: Record<string, any> = {}) {
  return {
    id: "track-1",
    tenantId: TENANT_A,
    invoiceId: INVOICE_ID,
    awb: "JNE123456789",
    courierCode: "jne",
    providerStatus: null,
    providerDelivered: null,
    events: null,
    lastRefreshedAt: null,
    ...overrides,
  };
}

function buildMockPrisma(opts: {
  invoice?: any;
  tracking?: any;
  transactionError?: string;
} = {}) {
  const invoice = opts.invoice ?? buildInvoice();
  const tracking = opts.tracking ?? null;

  const invoiceTracking = {
    findUnique: vi.fn().mockResolvedValue(tracking),
    upsert: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
  };

  const invoiceModel = {
    findUnique: vi.fn().mockResolvedValue(invoice),
    update: vi.fn().mockResolvedValue({}),
  };

  const prisma: any = {
    invoice: invoiceModel,
    invoiceTracking,
    $transaction: opts.transactionError
      ? vi.fn().mockRejectedValue(new Error(opts.transactionError))
      : vi.fn(async (cb: any) => {
          const tx = {
            invoice: { update: vi.fn().mockResolvedValue({}) },
            invoiceTracking: {
              upsert: invoiceTracking.upsert,
              update: invoiceTracking.update,
            },
          };
          return cb(tx);
        }),
  };

  return { prisma, invoiceModel, invoiceTracking };
}

beforeEach(() => {
  vi.clearAllMocks();
  (getCurrentTenantId as any).mockResolvedValue(TENANT_A);
  (getSystemUserId as any).mockResolvedValue(USER_ID);
  (requireRole as any).mockResolvedValue(true);
  (getRajaOngkirClientConfig as any).mockReset();
  (trackWaybillDetailed as any).mockReset();
  (normalizeTrackingResponse as any).mockReset();
});

// =============================================================================
// saveInvoiceAwb
// =============================================================================

describe("saveInvoiceAwb", () => {
  it("rejects non-COURIER invoices", async () => {
    const { prisma } = buildMockPrisma({
      invoice: buildInvoice({ shippingMethod: "WALK_IN" }),
    });
    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const { saveInvoiceAwb } = await import("./actions");
    const result = await saveInvoiceAwb(INVOICE_ID, { awb: "JNE123" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("kurir");
  }, 15_000);

  it("rejects cross-tenant invoice", async () => {
    const { prisma } = buildMockPrisma({
      invoice: buildInvoice({ tenantId: TENANT_B }),
    });
    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const { saveInvoiceAwb } = await import("./actions");
    const result = await saveInvoiceAwb(INVOICE_ID, { awb: "JNE123" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Akses ditolak");
  });

  it("derives canonical courier from invoice, not client", async () => {
    const { prisma, invoiceTracking } = buildMockPrisma();
    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const { saveInvoiceAwb } = await import("./actions");
    await saveInvoiceAwb(INVOICE_ID, { awb: "JNE-999" });

    const upsertCall = invoiceTracking.upsert.mock.calls[0][0];
    expect(upsertCall.create.courierCode).toBe("jne");
  });

  it("trims AWB whitespace", async () => {
    const { prisma, invoiceTracking } = buildMockPrisma();
    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const { saveInvoiceAwb } = await import("./actions");
    await saveInvoiceAwb(INVOICE_ID, { awb: "  JNE-999  " });

    const upsertCall = invoiceTracking.upsert.mock.calls[0][0];
    expect(upsertCall.create.awb).toBe("JNE-999");
    expect(upsertCall.update.awb).toBe("JNE-999");
  });

  it("AWB replacement resets tracking state", async () => {
    const { prisma, invoiceTracking } = buildMockPrisma({
      tracking: buildTracking({ awb: "OLD-AWB", providerStatus: "DELIVERED" }),
    });
    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const { saveInvoiceAwb } = await import("./actions");
    await saveInvoiceAwb(INVOICE_ID, { awb: "NEW-AWB" });

    const upsertCall = invoiceTracking.upsert.mock.calls[0][0];
    expect(upsertCall.update.awb).toBe("NEW-AWB");
    expect(upsertCall.update.providerStatus).toBeNull();
    expect(upsertCall.update.providerDelivered).toBeNull();
    expect(upsertCall.update.lastRefreshedAt).toBeNull();
  });

  it("rejects void invoices", async () => {
    const { prisma } = buildMockPrisma({
      invoice: buildInvoice({ status: "VOID" }),
    });
    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const { saveInvoiceAwb } = await import("./actions");
    const result = await saveInvoiceAwb(INVOICE_ID, { awb: "JNE123" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("void");
  });

  it("rejects when courierCode is missing", async () => {
    const { prisma } = buildMockPrisma({
      invoice: buildInvoice({ shippingCourierCode: null }),
    });
    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const { saveInvoiceAwb } = await import("./actions");
    const result = await saveInvoiceAwb(INVOICE_ID, { awb: "JNE123" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("kurir");
  });

  it("writes audit on success using the tenant prisma client", async () => {
    const { prisma } = buildMockPrisma();
    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const { saveInvoiceAwb } = await import("./actions");
    const result = await saveInvoiceAwb(INVOICE_ID, { awb: "JNE-NEW" });

    expect(result.success).toBe(true);
    // Regression: recordAudit used to receive `{}` as the transaction client —
    // the mutation committed, then the audit threw, reporting a false failure.
    // It must receive the tenant-scoped client so the audit actually persists.
    expect(recordAudit).toHaveBeenCalledTimes(1);
    expect(recordAudit).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        tenantId: TENANT_A,
        entityType: "InvoiceAwb",
        entityId: INVOICE_ID,
        action: "UPDATE",
      }),
    );
  });

  it("atomic: transaction failure prevents both writes", async () => {
    const { prisma, invoiceTracking } = buildMockPrisma({
      transactionError: "DB connection lost",
    });
    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const { saveInvoiceAwb } = await import("./actions");
    const result = await saveInvoiceAwb(INVOICE_ID, { awb: "JNE123" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("DB connection lost");
    expect(invoiceTracking.upsert).not.toHaveBeenCalled();
  });
});

// =============================================================================
// refreshInvoiceTracking
// =============================================================================

describe("refreshInvoiceTracking", () => {
  it("rejects cross-tenant invoice", async () => {
    const { prisma } = buildMockPrisma({
      invoice: buildInvoice({ tenantId: TENANT_B }),
    });
    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const { refreshInvoiceTracking } = await import("./actions");
    const result = await refreshInvoiceTracking(INVOICE_ID);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Akses ditolak");
  });

  it("rejects non-COURIER invoice", async () => {
    const { prisma } = buildMockPrisma({
      invoice: buildInvoice({ shippingMethod: "WALK_IN" }),
    });
    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const { refreshInvoiceTracking } = await import("./actions");
    const result = await refreshInvoiceTracking(INVOICE_ID);

    expect(result.success).toBe(false);
    expect(result.error).toContain("kurir");
  });

  it("rejects when no tracking row exists", async () => {
    const { prisma } = buildMockPrisma({ tracking: null });
    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const { refreshInvoiceTracking } = await import("./actions");
    const result = await refreshInvoiceTracking(INVOICE_ID);

    expect(result.success).toBe(false);
    expect(result.error).toContain("AWB belum tercatat");
  });

  it("provider failure leaves existing tracking state unchanged", async () => {
    const existingTracking = buildTracking({
      providerStatus: "PICKED UP",
      providerDelivered: false,
      lastRefreshedAt: new Date("2026-01-01"),
    });
    const { prisma, invoiceTracking } = buildMockPrisma({
      tracking: existingTracking,
    });
    (requireTenantPrisma as any).mockResolvedValue(prisma);
    (getRajaOngkirClientConfig as any).mockResolvedValue({});
    (trackWaybillDetailed as any).mockRejectedValue(new Error("API timeout"));

    const { refreshInvoiceTracking } = await import("./actions");
    const result = await refreshInvoiceTracking(INVOICE_ID);

    expect(result.success).toBe(false);
    expect(result.error).toContain("API timeout");
    expect(invoiceTracking.update).not.toHaveBeenCalled();
  });

  it("repeated refresh does not create duplicate rows (update, not insert)", async () => {
    const existingTracking = buildTracking();
    const { prisma, invoiceTracking } = buildMockPrisma({
      tracking: existingTracking,
    });
    (requireTenantPrisma as any).mockResolvedValue(prisma);
    (getRajaOngkirClientConfig as any).mockResolvedValue({});
    (trackWaybillDetailed as any).mockResolvedValue({
      summary: { status: "IN_TRANSIT", delivered: false },
      details: [],
    });
    (normalizeTrackingResponse as any).mockReturnValue({
      awb: "JNE123",
      courierCode: "jne",
      providerStatus: "IN_TRANSIT",
      providerDelivered: false,
      events: [],
      lastRefreshedAt: new Date().toISOString(),
    });

    const { refreshInvoiceTracking } = await import("./actions");

    await refreshInvoiceTracking(INVOICE_ID);
    await refreshInvoiceTracking(INVOICE_ID);

    // Only .update called, never .create
    expect(invoiceTracking.update).toHaveBeenCalledTimes(2);
    expect(invoiceTracking.upsert).not.toHaveBeenCalled();
  });
});

// =============================================================================
// fulfillment safety
// =============================================================================

describe("fulfillment safety", () => {
  it("provider delivered=true does NOT change fulfillmentStatus", async () => {
    const invoice = buildInvoice({ fulfillmentStatus: "SHIPPED" });
    const existingTracking = buildTracking();
    const { prisma, invoiceTracking } = buildMockPrisma({
      invoice,
      tracking: existingTracking,
    });
    (requireTenantPrisma as any).mockResolvedValue(prisma);
    (getRajaOngkirClientConfig as any).mockResolvedValue({});
    (trackWaybillDetailed as any).mockResolvedValue({
      summary: { status: "DELIVERED", delivered: true },
      details: [],
    });
    (normalizeTrackingResponse as any).mockReturnValue({
      awb: "JNE123",
      courierCode: "jne",
      providerStatus: "DELIVERED",
      providerDelivered: true,
      events: [],
      lastRefreshedAt: new Date().toISOString(),
    });

    const { refreshInvoiceTracking } = await import("./actions");
    await refreshInvoiceTracking(INVOICE_ID);

    // refreshInvoiceTracking only updates InvoiceTracking — never touches Invoice
    expect(prisma.invoice.update).not.toHaveBeenCalled();
    expect(invoiceTracking.update).toHaveBeenCalledTimes(1);
    const updateCall = invoiceTracking.update.mock.calls[0][0];
    expect(updateCall.data.providerDelivered).toBe(true);
    expect(updateCall.data.providerStatus).toBe("DELIVERED");
  });

  it("no accounting mutation occurs from tracking refresh", async () => {
    const existingTracking = buildTracking();
    const { prisma, invoiceTracking } = buildMockPrisma({
      tracking: existingTracking,
    });
    (requireTenantPrisma as any).mockResolvedValue(prisma);
    (getRajaOngkirClientConfig as any).mockResolvedValue({});
    (trackWaybillDetailed as any).mockResolvedValue({
      summary: { status: "DELIVERED", delivered: true },
      details: [],
    });
    (normalizeTrackingResponse as any).mockReturnValue({
      awb: "JNE123",
      courierCode: "jne",
      providerStatus: "DELIVERED",
      providerDelivered: true,
      events: [],
      lastRefreshedAt: new Date().toISOString(),
    });

    const { refreshInvoiceTracking } = await import("./actions");
    await refreshInvoiceTracking(INVOICE_ID);

    // Only invoiceTracking.update should be called — nothing else
    expect(prisma.invoice.update).not.toHaveBeenCalled();
    expect(invoiceTracking.update).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// tenant isolation
// =============================================================================

describe("tenant isolation", () => {
  it("tenant A cannot track tenant B invoice via getInvoiceTracking", async () => {
    const { prisma } = buildMockPrisma({
      invoice: buildInvoice({ tenantId: TENANT_B }),
    });
    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const { getInvoiceTracking } = await import("./actions");
    const result = await getInvoiceTracking(INVOICE_ID);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Akses ditolak");
  });

  it("tenant A cannot save AWB for tenant B invoice", async () => {
    const { prisma } = buildMockPrisma({
      invoice: buildInvoice({ tenantId: TENANT_B }),
    });
    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const { saveInvoiceAwb } = await import("./actions");
    const result = await saveInvoiceAwb(INVOICE_ID, { awb: "JNE123" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Akses ditolak");
  });

  it("tenant A cannot refresh tracking for tenant B invoice", async () => {
    const { prisma } = buildMockPrisma({
      invoice: buildInvoice({ tenantId: TENANT_B }),
    });
    (requireTenantPrisma as any).mockResolvedValue(prisma);

    const { refreshInvoiceTracking } = await import("./actions");
    const result = await refreshInvoiceTracking(INVOICE_ID);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Akses ditolak");
  });
});
