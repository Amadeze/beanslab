import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOverdueReminders } from "@/lib/overdue-reminders";
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
        jobName: "overdue-reminders",
        runKey: `overdue-reminders:${getZonedDayRange(now, "UTC").dateKey}`,
      },
      () => sendOverdueReminders(prisma, now),
    );
    return NextResponse.json({ ok: true, skipped: tracked.skipped, ...tracked.result });
  } catch (error) {
    console.error("[cron/overdue-reminders]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return runCron(request);
}

export async function POST(request: Request) {
  return runCron(request);
}
