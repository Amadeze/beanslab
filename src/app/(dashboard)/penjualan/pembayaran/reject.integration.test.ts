import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { getCurrentDate } from "@/lib/date-utils";
import { rejectPaymentSubmission } from "./actions";

// Gated integration test: only runs against an isolated test DB with RUN_INTEGRATION=true.
const integrationEnabled = process.env.RUN_INTEGRATION === "true";
const suite = integrationEnabled ? describe : describe.skip;

const authState = vi.hoisted(() => ({ tenantId: "tenant-reject-a" }));

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

const TENANT_A = "tenant-reject-a";
const TENANT_B = "tenant-reject-b";
const USER_A = "user-tenant-reject-a";
const USER_B = "user-tenant-reject-b";

let submissionCounter = 0;

suite("payment submission rejection (integration)", () => {
  let customerId = "";
  let invoiceId = "";

  beforeAll(async () => {
    for (const [id, code, subdomain] of [
      [TENANT_A, "REJA", "reject-a"],
      [TENANT_B, "REJB", "reject-b"],
    ] as const) {
      await prisma.tenant.upsert({
        where: { id },
        create: {
          id,
          code,
          name: `Reject Tenant ${code}`,
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
      create: {
        id: USER_A,
        email: "reject-a@example.com",
        name: "Reject Owner A",
        tenantId: TENANT_A,
        role: "OWNER",
      },
      update: {},
    });
    await prisma.user.upsert({
      where: { id: USER_B },
      create: {
        id: USER_B,
        email: "reject-b@example.com",
        name: "Reject Owner B",
        tenantId: TENANT_B,
        role: "OWNER",
      },
      update: {},
    });
    const customer = await prisma.customer.create({
      data: {
        tenantId: TENANT_A,
        code: "CUST-REJA-1",
        name: "Reject Customer",
      },
    });
    customerId = customer.id;
    const invoice = await prisma.invoice.create({
      data: {
        tenantId: TENANT_A,
        code: "INV-REJA-0001",
        customerId,
        createdById: USER_A,
        status: "ISSUED",
        subtotal: 100_000,
        discount: 0,
        tax: 0,
        shippingCost: 0,
        grandTotal: 100_000,
        paidAmount: 0,
      },
    });
    invoiceId = invoice.id;
  });

  beforeEach(() => {
    authState.tenantId = TENANT_A;
  });

  afterAll(async () => {
    await prisma.paymentSubmission.deleteMany({ where: { tenantId: TENANT_A } });
    await prisma.auditLog.deleteMany({ where: { tenantId: TENANT_A } });
    await prisma.invoice.deleteMany({ where: { tenantId: TENANT_A } });
    await prisma.customer.deleteMany({ where: { tenantId: TENANT_A } });
    await prisma.user.deleteMany({
      where: { id: { in: [USER_A, USER_B] } },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [TENANT_A, TENANT_B] } },
    });
  });

  async function createSubmission(): Promise<string> {
    submissionCounter += 1;
    const row = await prisma.paymentSubmission.create({
      data: {
        tenantId: TENANT_A,
        invoiceId,
        publicToken: `tok-reject-a-${submissionCounter}`,
        method: "TRANSFER",
        status: "AWAITING_VERIFICATION",
        amount: 100_000,
        expiresAt: new Date(getCurrentDate().getTime() + 24 * 60 * 60 * 1_000),
      },
    });
    return row.id;
  }

  async function rejectAuditCount(submissionId: string): Promise<number> {
    return prisma.auditLog.count({
      where: {
        tenantId: TENANT_A,
        action: "REJECT",
        entityType: "PaymentSubmission",
        entityId: submissionId,
      },
    });
  }

  it("a tenant cannot review another tenant's payment submission", async () => {
    const submissionId = await createSubmission();
    authState.tenantId = TENANT_B;

    const result = await rejectPaymentSubmission(submissionId, "Alasan dari tenant lain");
    expect(result).toEqual({ success: false, error: "Bukti sudah diproses." });

    const row = await prisma.paymentSubmission.findUnique({
      where: { id: submissionId },
    });
    expect(row?.status).toBe("AWAITING_VERIFICATION");
    expect(await rejectAuditCount(submissionId)).toBe(0);
  });

  it("only one of two parallel rejects succeeds", async () => {
    const submissionId = await createSubmission();

    const results = await Promise.allSettled([
      rejectPaymentSubmission(submissionId, "Alasan pertama"),
      rejectPaymentSubmission(submissionId, "Alasan kedua"),
    ]);

    const values = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<Awaited<ReturnType<typeof rejectPaymentSubmission>>>).value);
    expect(values).toHaveLength(2);
    const successes = values.filter((v) => v.success === true);
    const failures = values.filter((v) => v.success === false);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toEqual({ success: false, error: "Bukti sudah diproses." });

    const row = await prisma.paymentSubmission.findUnique({
      where: { id: submissionId },
    });
    expect(row?.status).toBe("REJECTED");
    expect(row?.rejectionReason).toMatch(/^Alasan (pertama|kedua)$/);
    expect(row?.reviewedById).toBe(USER_A);
    expect(await rejectAuditCount(submissionId)).toBe(1);
  });

  it("keeps payment, journal, and invoice consistent after rejection", async () => {
    const submissionId = await createSubmission();

    const result = await rejectPaymentSubmission(submissionId, "Alasan konsistensi");
    expect(result).toEqual({ success: true });

    expect(
      await prisma.payment.count({ where: { tenantId: TENANT_A, invoiceId } }),
    ).toBe(0);
    expect(
      await prisma.journalEntry.count({ where: { tenantId: TENANT_A, reference: invoiceId } }),
    ).toBe(0);
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(invoice?.status).toBe("ISSUED");
    expect(invoice?.paidAmount.toNumber()).toBe(0);
    expect(await rejectAuditCount(submissionId)).toBe(1);
  });

  it("rejecting an already-processed submission returns a controlled error", async () => {
    const submissionId = await createSubmission();

    const first = await rejectPaymentSubmission(submissionId, "Alasan pertama");
    expect(first).toEqual({ success: true });

    const second = await rejectPaymentSubmission(submissionId, "Alasan kedua");
    expect(second).toEqual({ success: false, error: "Bukti sudah diproses." });

    const row = await prisma.paymentSubmission.findUnique({
      where: { id: submissionId },
    });
    expect(row?.status).toBe("REJECTED");
    expect(row?.rejectionReason).toBe("Alasan pertama");
    expect(await rejectAuditCount(submissionId)).toBe(1);
  });
});
