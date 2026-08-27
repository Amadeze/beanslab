import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { synchronizeSubscriptionStatuses } from "@/lib/subscription-maintenance";
import { timingSafeEqualText } from "@/lib/webhook-inbox";
import { runTrackedJob } from "@/lib/job-runner";
import { getCurrentDate, getZonedDayRange } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

async function runCron(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (
    !cronSecret
    || !authorization
    || !timingSafeEqualText(`Bearer ${cronSecret}`, authorization)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = getCurrentDate();
    const tracked = await runTrackedJob(
      prisma,
      {
        jobName: "subscriptions",
        runKey: `subscriptions:${getZonedDayRange(now, "UTC").dateKey}`,
      },
      () => synchronizeSubscriptionStatuses(prisma, now),
    );
    return NextResponse.json({ ok: true, skipped: tracked.skipped, ...tracked.result });
  } catch (error) {
    console.error("[cron/subscriptions]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return runCron(request);
}

export async function POST(request: Request) {
  return runCron(request);
}
