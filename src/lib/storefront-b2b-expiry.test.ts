import { describe, expect, it, vi } from "vitest";
import { expireUnpaidStorefrontOrders } from "./payment-submission-expiry";

describe("B2B storefront reservation expiry", () => {
  it("excludes approved B2B_DIRECT credit orders from retail payment expiry", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const client = {
      invoice: { findMany },
      $transaction: vi.fn(),
    } as any;

    await expect(expireUnpaidStorefrontOrders(client, new Date("2026-08-22T00:00:00.000Z")))
      .resolves.toEqual({ expiredOrders: 0, voidedInvoices: 0 });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        publicOrderToken: { not: null },
        NOT: { salesChannel: "B2B_DIRECT", paymentMethod: "CREDIT" },
      }),
    }));
  });
});
