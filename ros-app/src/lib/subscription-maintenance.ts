import type { PrismaClient } from "@prisma/client";
import { getCurrentDate } from "@/lib/date-utils";

export async function synchronizeSubscriptionStatuses(
  prisma: Pick<PrismaClient, "tenant">,
  now = getCurrentDate(),
) {
  const [expiredTrials, pastDueSubscriptions] = await Promise.all([
    prisma.tenant.updateMany({
      where: {
        subscriptionTier: "TRIAL",
        subscriptionStatus: "ACTIVE",
        trialEndsAt: { lte: now },
      },
      data: { subscriptionStatus: "EXPIRED" },
    }),
    prisma.tenant.updateMany({
      where: {
        subscriptionTier: { in: ["BASIC", "PRO", "ENTERPRISE"] },
        subscriptionStatus: "ACTIVE",
        nextBillingDate: { lte: now },
      },
      data: { subscriptionStatus: "PAST_DUE" },
    }),
  ]);

  return {
    expiredTrials: expiredTrials.count,
    pastDueSubscriptions: pastDueSubscriptions.count,
  };
}
