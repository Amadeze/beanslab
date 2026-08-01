import { NextResponse } from "next/server";
import { getCurrentDate } from "@/lib/date-utils";
import { runTrackedJob } from "@/lib/job-runner";
import { expirePaymentSubmissions } from "@/lib/payment-submission-expiry";
import { prisma } from "@/lib/prisma";
import { timingSafeEqualText } from "@/lib/webhook-inbox";

export const dynamic = "force-dynamic";

async function runCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization || !timingSafeEqualText(`Bearer ${secret}`, authorization)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const now = getCurrentDate();
    const slot = now.toISOString().slice(0, 13);
    const tracked = await runTrackedJob(
      prisma,
      { jobName: "payment-submissions", runKey: `payment-submissions:${slot}` },
      () => expirePaymentSubmissions(prisma, now),
    );
    return NextResponse.json({ ok: true, skipped: tracked.skipped, ...tracked.result });
  } catch (error) {
    console.error("[cron/payment-submissions]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return runCron(request);
}

export async function POST(request: Request) {
  return runCron(request);
}
