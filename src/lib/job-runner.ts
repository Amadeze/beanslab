import { Prisma, type PrismaClient } from "@prisma/client";
import { getCurrentDate } from "@/lib/date-utils";

export const DEFAULT_JOB_LEASE_MS = 60000;

export function leaseCutoff(now: Date, leaseMs: number) { 
  return new Date(now.getTime() - leaseMs); 
}

export function buildClaimableWhere(runKey: string, cutoff: Date): Prisma.JobRunWhereInput { 
  return { 
    runKey,
    status: { in: ["RUNNING", "FAILED"] },
    OR: [
      { status: "FAILED" }, 
      { status: "RUNNING", startedAt: { lt: cutoff } }
    ] 
  }; 
}

export async function runTrackedJob<T>(
  client: PrismaClient,
  input: { jobName: string; runKey: string; leaseMs?: number },
  work: () => Promise<T>,
): Promise<{ skipped: boolean; result: T | null }> {
  const existing = await client.jobRun.findUnique({
    where: { runKey: input.runKey },
    select: { status: true, summary: true },
  });

  if (existing?.status === "SUCCEEDED") {
    return { skipped: true, result: existing.summary as T | null };
  }

  const now = getCurrentDate();
  const leaseMs = input.leaseMs ?? DEFAULT_JOB_LEASE_MS;
  const cutoff = leaseCutoff(now, leaseMs);
  const claimToken = crypto.randomUUID();

  if (!existing) {
    const created = await client.jobRun.createMany({
      data: [{
        jobName: input.jobName,
        runKey: input.runKey,
        status: "RUNNING",
        startedAt: now,
        claimToken
      }],
      skipDuplicates: true
    });

    if (created.count === 0) {
      // Race lost, someone else created it. Try to claim if failed/expired
      const claimed = await client.jobRun.updateMany({
        where: buildClaimableWhere(input.runKey, cutoff),
        data: {
          status: "RUNNING",
          startedAt: now,
          claimToken,
          attempt: { increment: 1 }
        }
      });
      if (claimed.count === 0) return { skipped: true, result: null };
    }
  } else {
    const claimed = await client.jobRun.updateMany({
      where: buildClaimableWhere(input.runKey, cutoff),
      data: {
        status: "RUNNING",
        startedAt: now,
        claimToken,
        attempt: { increment: 1 }
      }
    });
    if (claimed.count === 0) return { skipped: true, result: null };
  }

  try {
    const result = await work();
    
    // Settlement guard
    const settled = await client.jobRun.updateMany({
      where: { runKey: input.runKey, claimToken },
      data: {
        status: "SUCCEEDED",
        finishedAt: getCurrentDate(),
        summary: result ? JSON.parse(JSON.stringify(result)) : Prisma.JsonNull
      }
    });
    
    if (settled.count === 0) return { skipped: true, result: null }; // Claim lost
    return { skipped: false, result };
    
  } catch (error) {
    // Write FAILED only if we still hold the claim
    await client.jobRun.updateMany({
      where: { runKey: input.runKey, claimToken },
      data: {
        status: "FAILED",
        finishedAt: getCurrentDate(),
        error: error instanceof Error ? error.message : String(error)
      }
    });
    throw error;
  }
}
