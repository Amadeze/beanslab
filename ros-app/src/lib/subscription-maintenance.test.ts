import { describe, expect, it, vi } from "vitest";
import { synchronizeSubscriptionStatuses } from "./subscription-maintenance";

describe("synchronizeSubscriptionStatuses", () => {
  it("expires trials and marks paid plans past due", async () => {
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 3 });
    const now = new Date("2026-07-16T00:00:00.000Z");

    const result = await synchronizeSubscriptionStatuses(
      { tenant: { updateMany } } as never,
      now,
    );

    expect(result).toEqual({
      expiredTrials: 2,
      pastDueSubscriptions: 3,
    });
    expect(updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          subscriptionTier: "TRIAL",
          trialEndsAt: { lte: now },
        }),
        data: { subscriptionStatus: "EXPIRED" },
      }),
    );
    expect(updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          nextBillingDate: { lte: now },
        }),
        data: { subscriptionStatus: "PAST_DUE" },
      }),
    );
  });
});
