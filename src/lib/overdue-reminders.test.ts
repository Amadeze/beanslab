import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./notifications", () => ({
  sendOverdueReminderEmail: vi.fn().mockResolvedValue({ success: true }),
  sendOverdueReminderWhatsApp: vi.fn().mockResolvedValue({ success: true }),
}));

import { sendOverdueReminderEmail } from "./notifications";
import { sendOverdueReminders } from "./overdue-reminders";

const originalResendKey = process.env.RESEND_API_KEY;
const originalWaKey = process.env.WA_API_KEY;

afterEach(() => {
  if (originalResendKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalResendKey;
  if (originalWaKey === undefined) delete process.env.WA_API_KEY;
  else process.env.WA_API_KEY = originalWaKey;
  vi.clearAllMocks();
});

function overdueInvoice(overrides: Partial<{ grandTotal: number; paidAmount: number; returnedAmount: number; id: string; code: string }> = {}) {
  return {
    id: "invoice-1",
    tenantId: "tenant-1",
    code: "INV-001",
    grandTotal: 100_000,
    paidAmount: 25_000,
    returnedAmount: 0,
    dueDate: new Date("2026-07-10T00:00:00.000Z"),
    paymentUrl: null,
    customer: {
      name: "Kafe Uji",
      email: "billing@example.com",
      phone: null,
    },
    tenant: {
      id: "tenant-1",
      name: "Roastery Uji",
      isActive: true,
      subscriptionTier: "PRO",
      subscriptionStatus: "ACTIVE",
      trialEndsAt: null,
      nextBillingDate: new Date("2026-08-01T00:00:00.000Z"),
    },
    ...overrides,
  };
}

describe("sendOverdueReminders", () => {
  it("skips invoices whose balance is fully offset by returns (2F.2)", async () => {
    const prisma = {
      invoice: {
        findMany: vi.fn().mockResolvedValue([
          overdueInvoice(), // saldo 75.000 → tetap dikirim
          overdueInvoice({ id: "invoice-2", code: "INV-002", grandTotal: 50_000, paidAmount: 0, returnedAmount: 50_000 }), // saldo 0 → skip
        ]),
      },
      notificationPreference: { findMany: vi.fn().mockResolvedValue([]) },
      reminderDelivery: { create: vi.fn(), update: vi.fn() },
    };

    const result = await sendOverdueReminders(
      prisma as never,
      new Date("2026-07-16T00:00:00.000Z"),
    );

    expect(result).toEqual({ overdueInvoices: 2, sent: 0, failed: 0, skipped: 2 });
  });

  it("skips delivery when no provider is configured", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.WA_API_KEY;
    const prisma = {
      invoice: { findMany: vi.fn().mockResolvedValue([overdueInvoice()]) },
      notificationPreference: { findMany: vi.fn().mockResolvedValue([]) },
      reminderDelivery: {
        create: vi.fn(),
        update: vi.fn(),
      },
    };

    const result = await sendOverdueReminders(
      prisma as never,
      new Date("2026-07-16T00:00:00.000Z"),
    );

    expect(result).toEqual({
      overdueInvoices: 1,
      sent: 0,
      failed: 0,
      skipped: 1,
    });
    expect(prisma.reminderDelivery.create).not.toHaveBeenCalled();
  });

  it("claims and records one email delivery per invoice and day", async () => {
    process.env.RESEND_API_KEY = "test-key";
    delete process.env.WA_API_KEY;
    const prisma = {
      invoice: { findMany: vi.fn().mockResolvedValue([overdueInvoice()]) },
      notificationPreference: { findMany: vi.fn().mockResolvedValue([]) },
      reminderDelivery: {
        create: vi.fn().mockResolvedValue({ id: "delivery-1" }),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    const result = await sendOverdueReminders(
      prisma as never,
      new Date("2026-07-16T03:00:00.000Z"),
    );

    expect(result.sent).toBe(1);
    expect(prisma.reminderDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        invoiceId: "invoice-1",
        channel: "EMAIL",
        reminderDate: new Date("2026-07-16T00:00:00.000Z"),
      }),
    });
    expect(sendOverdueReminderEmail).toHaveBeenCalledOnce();
    expect(prisma.reminderDelivery.update).toHaveBeenCalledWith({
      where: { id: "delivery-1" },
      data: { status: "SENT", sentAt: expect.any(Date) },
    });
  });

  it("honors an explicitly disabled tenant channel", async () => {
    process.env.RESEND_API_KEY = "test-key";
    const prisma = {
      invoice: { findMany: vi.fn().mockResolvedValue([overdueInvoice()]) },
      notificationPreference: {
        findMany: vi.fn().mockResolvedValue([
          { tenantId: "tenant-1", channel: "EMAIL", enabled: false },
        ]),
      },
      reminderDelivery: {
        create: vi.fn(),
        update: vi.fn(),
      },
    };

    const result = await sendOverdueReminders(
      prisma as never,
      new Date("2026-07-16T03:00:00.000Z"),
    );

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
    expect(prisma.reminderDelivery.create).not.toHaveBeenCalled();
  });
});
