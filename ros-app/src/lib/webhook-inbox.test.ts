import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { claimWebhookEvent, timingSafeEqualText } from "./webhook-inbox";
import { getCurrentDate } from "@/lib/date-utils";

function duplicateError() {
  return new Prisma.PrismaClientKnownRequestError("duplicate", {
    code: "P2002",
    clientVersion: "test",
  });
}

describe("claimWebhookEvent", () => {
  it("claims a new event", async () => {
    const client = {
      webhookEvent: {
        create: vi.fn().mockResolvedValue({ id: "event-1" }),
      },
    };
    await expect(claimWebhookEvent(client, {
      tenantId: "tenant-1",
      provider: "MIDTRANS",
      eventId: "external-1",
      eventType: "settlement",
      payload: {},
    })).resolves.toMatchObject({ claimed: true, eventId: "event-1", retry: false });
  });

  it("keeps processed duplicates terminal", async () => {
    const client = {
      webhookEvent: {
        create: vi.fn().mockRejectedValue(duplicateError()),
        findUnique: vi.fn().mockResolvedValue({
          id: "event-1",
          status: "PROCESSED",
          receivedAt: getCurrentDate(),
        }),
        updateMany: vi.fn(),
      },
    };
    const result = await claimWebhookEvent(client, {
      tenantId: "tenant-1",
      provider: "MIDTRANS",
      eventId: "external-1",
      eventType: "settlement",
      payload: {},
    });
    expect(result.claimed).toBe(false);
    expect(client.webhookEvent.updateMany).not.toHaveBeenCalled();
  });

  it("reclaims failed and stale received events", async () => {
    const now = new Date("2026-07-16T12:00:00Z");
    for (const existing of [
      { status: "FAILED", receivedAt: now },
      { status: "RECEIVED", receivedAt: new Date(now.getTime() - 10 * 60 * 1000) },
    ]) {
      const client = {
        webhookEvent: {
          create: vi.fn().mockRejectedValue(duplicateError()),
          findUnique: vi.fn().mockResolvedValue({ id: "event-1", ...existing }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      };
      await expect(claimWebhookEvent(client, {
        tenantId: "tenant-1",
        provider: "MIDTRANS",
        eventId: "external-1",
        eventType: "settlement",
        payload: {},
        now,
      })).resolves.toMatchObject({ claimed: true, retry: true });
    }
  });
});

describe("timingSafeEqualText", () => {
  it("compares equal values without accepting different lengths", () => {
    expect(timingSafeEqualText("abc", "abc")).toBe(true);
    expect(timingSafeEqualText("abc", "abd")).toBe(false);
    expect(timingSafeEqualText("abc", "abcd")).toBe(false);
  });
});
