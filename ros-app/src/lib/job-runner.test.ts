import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import {
  DEFAULT_JOB_LEASE_MS,
  buildClaimableWhere,
  leaseCutoff,
  runTrackedJob,
} from "./job-runner";

interface StubCalls {
  findUnique: ReturnType<typeof vi.fn>;
  createMany: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
}

function createStubClient(): StubCalls {
  return {
    findUnique: vi.fn(),
    createMany: vi.fn(),
    updateMany: vi.fn(),
  };
}

function asClient(stub: StubCalls): PrismaClient {
  return { jobRun: stub } as unknown as PrismaClient;
}

const JOB = { jobName: "test-job", runKey: "test-job:2026-08-03" };

describe("leaseCutoff / buildClaimableWhere (pure helpers)", () => {
  it("computes the cutoff as now minus the lease", () => {
    const now = new Date("2026-08-03T12:00:00.000Z");
    expect(leaseCutoff(now, 15_000).toISOString()).toBe("2026-08-03T11:59:45.000Z");
  });

  it("claims FAILED and RUNNING-with-expired-lease, never SUCCEEDED", () => {
    const cutoff = new Date("2026-08-03T11:59:45.000Z");
    const where = buildClaimableWhere("k", cutoff);
    expect(where.runKey).toBe("k");
    expect(where.status).toEqual({ in: ["RUNNING", "FAILED"] });
    expect(where.OR).toEqual([
      { status: "FAILED" },
      { status: "RUNNING", startedAt: { lt: cutoff } },
    ]);
    const serialized = JSON.stringify(where);
    expect(serialized).not.toContain("SUCCEEDED");
  });
});

describe("runTrackedJob — claim and lease", () => {
  it("claims a fresh runKey via createMany and settles SUCCEEDED guarded by runKey+claimToken", async () => {
    const stub = createStubClient();
    stub.findUnique.mockResolvedValue(null);
    stub.createMany.mockResolvedValue({ count: 1 });
    stub.updateMany.mockResolvedValue({ count: 1 });

    const result = await runTrackedJob(asClient(stub), JOB, async () => ({ ok: true }));

    expect(result).toEqual({ skipped: false, result: { ok: true } });
    expect(stub.createMany).toHaveBeenCalledTimes(1);
    const createdData = stub.createMany.mock.calls[0][0].data[0];
    expect(createdData.runKey).toBe(JOB.runKey);
    expect(createdData.status).toBe("RUNNING");
    expect(createdData.claimToken).toEqual(expect.any(String));
    expect(stub.updateMany).toHaveBeenCalledTimes(1);
    const settle = stub.updateMany.mock.calls[0][0];
    expect(settle.where).toEqual({ runKey: JOB.runKey, claimToken: createdData.claimToken });
    expect(settle.data.status).toBe("SUCCEEDED");
    expect(settle.data.summary).toEqual({ ok: true });
  });

  it("replays the stored summary when the run already SUCCEEDED (final) without writing", async () => {
    const stub = createStubClient();
    stub.findUnique.mockResolvedValue({ status: "SUCCEEDED", summary: { ok: true } });
    const work = vi.fn();

    const result = await runTrackedJob(asClient(stub), JOB, work);

    expect(result).toEqual({ skipped: true, result: { ok: true } });
    expect(work).not.toHaveBeenCalled();
    expect(stub.createMany).not.toHaveBeenCalled();
    expect(stub.updateMany).not.toHaveBeenCalled();
  });

  it("claims an existing FAILED run (retry) via updateMany with the claimable predicate", async () => {
    const stub = createStubClient();
    stub.findUnique.mockResolvedValue({ status: "FAILED", summary: null });
    stub.createMany.mockResolvedValue({ count: 0 });
    stub.updateMany.mockResolvedValue({ count: 1 });

    const before = new Date();
    const result = await runTrackedJob(
      asClient(stub),
      { ...JOB, leaseMs: 30_000 },
      async () => "ran",
    );
    const after = new Date();

    expect(result).toEqual({ skipped: false, result: "ran" });
    const claim = stub.updateMany.mock.calls[0][0];
    expect(claim.where.runKey).toBe(JOB.runKey);
    expect(claim.where.OR).toContainEqual({ status: "FAILED" });
    const expiredBranch = claim.where.OR.find((b: { status?: string }) => b.status === "RUNNING");
    const cutoff = (expiredBranch.startedAt as { lt: Date }).lt.getTime();
    const lower = before.getTime() - 30_000 - 2_000;
    const upper = after.getTime() - 30_000 + 2_000;
    expect(cutoff).toBeGreaterThanOrEqual(lower);
    expect(cutoff).toBeLessThanOrEqual(upper);
    expect(claim.data.attempt).toEqual({ increment: 1 });
    expect(claim.data.status).toBe("RUNNING");
  });

  it("claims an existing RUNNING row whose lease expired", async () => {
    const stub = createStubClient();
    stub.findUnique.mockResolvedValue({ status: "RUNNING", summary: null });
    stub.createMany.mockResolvedValue({ count: 0 });
    stub.updateMany.mockResolvedValue({ count: 1 });

    const result = await runTrackedJob(
      asClient(stub),
      { ...JOB, leaseMs: 1_000 },
      async () => "took-over",
    );

    expect(result.skipped).toBe(false);
    const claim = stub.updateMany.mock.calls[0][0];
    const expiredBranch = claim.where.OR.find((b: { status?: string }) => b.status === "RUNNING");
    expect(expiredBranch.startedAt).toEqual({ lt: expect.any(Date) });
  });

  it("skips without running work while another worker holds an active lease", async () => {
    const stub = createStubClient();
    stub.findUnique.mockResolvedValue({ status: "RUNNING", summary: null });
    stub.createMany.mockResolvedValue({ count: 0 });
    stub.updateMany.mockResolvedValue({ count: 0 });
    const work = vi.fn();

    const result = await runTrackedJob(asClient(stub), JOB, work);

    expect(result).toEqual({ skipped: true, result: null });
    expect(work).not.toHaveBeenCalled();
    expect(stub.updateMany).toHaveBeenCalledTimes(1);
  });

  it("uses the default lease when leaseMs is not provided", async () => {
    const stub = createStubClient();
    stub.findUnique.mockResolvedValue({ status: "RUNNING", summary: null });
    stub.createMany.mockResolvedValue({ count: 0 });
    stub.updateMany.mockResolvedValue({ count: 1 });

    await runTrackedJob(asClient(stub), JOB, async () => "x");

    const cutoff = stub.updateMany.mock.calls[0][0].where.OR[1].startedAt.lt as Date;
    const drift = Math.abs(Date.now() - DEFAULT_JOB_LEASE_MS - cutoff.getTime());
    expect(drift).toBeLessThan(2_000);
  });
});

describe("runTrackedJob — stale workers never overwrite", () => {
  it("discards the result of a worker whose claim was taken over", async () => {
    const stub = createStubClient();
    stub.findUnique.mockResolvedValue(null);
    stub.createMany.mockResolvedValue({ count: 1 });
    stub.updateMany.mockResolvedValue({ count: 0 }); // settlement guard misses: claim lost

    const result = await runTrackedJob(asClient(stub), JOB, async () => "stale-result");

    expect(result).toEqual({ skipped: true, result: null });
    const settle = stub.updateMany.mock.calls[0][0];
    expect(settle.where.claimToken).toEqual(expect.any(String));
    expect(settle.data.status).toBe("SUCCEEDED");
  });

  it("does not write FAILED when the claim was lost, and rethrows", async () => {
    const stub = createStubClient();
    stub.findUnique.mockResolvedValue(null);
    stub.createMany.mockResolvedValue({ count: 1 });
    stub.updateMany.mockResolvedValue({ count: 0 });

    await expect(runTrackedJob(asClient(stub), JOB, async () => {
      throw new Error("boom");
    })).rejects.toThrow("boom");

    const settle = stub.updateMany.mock.calls[0][0];
    expect(settle.where).toEqual({ runKey: JOB.runKey, claimToken: expect.any(String) });
    expect(settle.data.status).toBe("FAILED");
  });

  it("writes FAILED with the claim guard and rethrows the error", async () => {
    const stub = createStubClient();
    stub.findUnique.mockResolvedValue(null);
    stub.createMany.mockResolvedValue({ count: 1 });
    stub.updateMany.mockResolvedValue({ count: 1 });

    await expect(runTrackedJob(asClient(stub), JOB, async () => {
      throw new Error("boom");
    })).rejects.toThrow("boom");

    const settle = stub.updateMany.mock.calls[0][0];
    expect(settle.data.status).toBe("FAILED");
    expect(settle.data.error).toBe("boom");
  });
});
