import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { processMqttLive, appendLiveEvent } from "./mqtt-bridge";
import { resolveTestDatabaseUrl } from "../../../test/setup/test-database-guard";

// Gated integration test: only runs against an isolated PostgreSQL test
// database with RUN_INTEGRATION=true + TEST_DATABASE_URL set. It exercises the
// LiveSession invariant "at most one ACTIVE session per (tenantId, machineId)"
// — enforced by the partial unique index live_sessions_active_unique — the
// fast-path acquire (findFirst first, create only when absent), and the atomic
// JSONB event append with affected-row verification (0 rows = session closed,
// so the event was not stored). Concurrency is proven by parallel calls with no
// timing/sleep-based guarantees.
const integrationEnabled = process.env.RUN_INTEGRATION === "true";
const suite = integrationEnabled ? describe : describe.skip;

suite("LiveSession concurrency — real PostgreSQL (TEST_DATABASE_URL)", () => {
  let client: PrismaClient;
  const tenantIds: string[] = [];
  const machineIds: string[] = [];

  const freshSuffix = () =>
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  async function createTenantFixture(label: string): Promise<string> {
    const id = `ls-tenant-${label}-${freshSuffix()}`;
    tenantIds.push(id);
    await client.tenant.create({
      data: { id, code: id, name: `LiveSession Test ${id}` },
    });
    return id;
  }

  async function createMachineFixture(
    tenantId: string,
    label: string,
  ): Promise<string> {
    const id = `ls-machine-${label}-${freshSuffix()}`;
    machineIds.push(id);
    await client.machine.create({
      data: { id, tenantId, name: `LiveSession Machine ${id}` },
    });
    return id;
  }

  const activeCount = (tenantId: string, machineId: string) =>
    client.liveSession.count({
      where: { tenantId, machineId, status: "ACTIVE" },
    });

  const telemetry = (seq: number) => ({
    eventType: "BT_UPDATE",
    data: { BT: 100 + seq, seq },
  });

  beforeAll(async () => {
    const pool = new Pool({
      connectionString: resolveTestDatabaseUrl(),
      max: 20,
    });
    client = new PrismaClient({ adapter: new PrismaPg(pool) });
    await client.$connect();
  });

  afterAll(async () => {
    if (client) {
      await client.liveSession.deleteMany({
        where: { machineId: { in: machineIds } },
      });
      await client.machine.deleteMany({ where: { id: { in: machineIds } } });
      await client.tenant.deleteMany({ where: { id: { in: tenantIds } } });

      expect(
        await client.liveSession.count({
          where: { machineId: { in: machineIds } },
        }),
      ).toBe(0);
      expect(
        await client.machine.count({ where: { id: { in: machineIds } } }),
      ).toBe(0);
      expect(
        await client.tenant.count({ where: { id: { in: tenantIds } } }),
      ).toBe(0);

      await client.$disconnect();
    }
  });

  it("fast path: an existing ACTIVE session is reused and stays a single ACTIVE row", async () => {
    const tenantId = await createTenantFixture("fastpath");
    const machineId = await createMachineFixture(tenantId, "fastpath");

    const first = await processMqttLive(tenantId, machineId, telemetry(1));
    const second = await processMqttLive(tenantId, machineId, telemetry(2));
    const third = await processMqttLive(tenantId, machineId, telemetry(3));

    expect(second.sessionId).toBe(first.sessionId);
    expect(third.sessionId).toBe(first.sessionId);
    expect(await activeCount(tenantId, machineId)).toBe(1);
    expect(await client.liveSession.count({ where: { machineId } })).toBe(1);

    const row = await client.liveSession.findFirst({ where: { machineId } });
    expect((row?.events as Array<{ data?: { seq?: number } }>)?.length).toBe(3);
  });

  it("12 concurrent acquisitions for the same tenant+machine yield exactly one ACTIVE row and one shared sessionId", async () => {
    const tenantId = await createTenantFixture("acq");
    const machineId = await createMachineFixture(tenantId, "acq");
    const N = 12;

    const results = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        processMqttLive(tenantId, machineId, telemetry(i)),
      ),
    );

    const sessionIds = results.map((r) => r.sessionId);
    expect(new Set(sessionIds).size).toBe(1);
    expect(await activeCount(tenantId, machineId)).toBe(1);
    expect(await client.liveSession.count({ where: { machineId } })).toBe(1);

    const row = await client.liveSession.findFirst({ where: { machineId } });
    expect((row?.events as Array<{ data?: { seq?: number } }>)?.length).toBe(N);
  });

  it("different tenants keep their own ACTIVE session", async () => {
    const tenantA = await createTenantFixture("tenant-a");
    const tenantB = await createTenantFixture("tenant-b");
    const machineA = await createMachineFixture(tenantA, "ta");
    const machineB = await createMachineFixture(tenantB, "tb");

    const results = await Promise.all([
      processMqttLive(tenantA, machineA, telemetry(1)),
      processMqttLive(tenantA, machineA, telemetry(2)),
      processMqttLive(tenantB, machineB, telemetry(1)),
      processMqttLive(tenantB, machineB, telemetry(2)),
    ]);

    expect(await activeCount(tenantA, machineA)).toBe(1);
    expect(await activeCount(tenantB, machineB)).toBe(1);
    expect(new Set(results.map((r) => r.sessionId)).size).toBe(2);
  });

  it("different machines keep their own ACTIVE session", async () => {
    const tenantId = await createTenantFixture("multi-machine");
    const machineA = await createMachineFixture(tenantId, "ma");
    const machineB = await createMachineFixture(tenantId, "mb");

    const results = await Promise.all([
      processMqttLive(tenantId, machineA, telemetry(1)),
      processMqttLive(tenantId, machineA, telemetry(2)),
      processMqttLive(tenantId, machineB, telemetry(1)),
      processMqttLive(tenantId, machineB, telemetry(2)),
    ]);

    expect(await activeCount(tenantId, machineA)).toBe(1);
    expect(await activeCount(tenantId, machineB)).toBe(1);
    expect(new Set(results.map((r) => r.sessionId)).size).toBe(2);
  });

  it("after the first session completes, a new ACTIVE session can be created", async () => {
    const tenantId = await createTenantFixture("resume");
    const machineId = await createMachineFixture(tenantId, "resume");

    const first = await processMqttLive(tenantId, machineId, telemetry(1));
    expect(await activeCount(tenantId, machineId)).toBe(1);

    await client.liveSession.updateMany({
      where: { tenantId, machineId, status: "ACTIVE" },
      data: { status: "COMPLETED" },
    });

    const second = await processMqttLive(tenantId, machineId, telemetry(2));

    expect(second.sessionId).not.toBe(first.sessionId);
    expect(await activeCount(tenantId, machineId)).toBe(1);
    expect(
      await client.liveSession.count({ where: { tenantId, machineId } }),
    ).toBe(2);
  });

  it("append to a session that is no longer ACTIVE is not treated as success (0 affected rows)", async () => {
    const tenantId = await createTenantFixture("closed");
    const machineId = await createMachineFixture(tenantId, "closed");

    const first = await processMqttLive(tenantId, machineId, telemetry(1));
    const row = await client.liveSession.findFirst({
      where: { tenantId, machineId },
    });
    expect(row).not.toBeNull();

    await client.liveSession.updateMany({
      where: { tenantId, machineId, status: "ACTIVE" },
      data: { status: "COMPLETED" },
    });

    const affected = await appendLiveEvent(
      row!.id,
      tenantId,
      machineId,
      new Date(),
      {
        type: "BT_UPDATE",
        timestamp: new Date().toISOString(),
        data: { seq: 99 },
      },
    );

    expect(affected).toBe(0);
    expect(await activeCount(tenantId, machineId)).toBe(0);
    const stored = await client.liveSession.findFirst({ where: { id: row!.id } });
    expect((stored?.events as Array<{ data?: { seq?: number } }>)?.length).toBe(1);
    expect(first.sessionId).toBeTruthy();
  });

  it("after the session is closed, processMqttLive reacquires a fresh ACTIVE session and stores the event there", async () => {
    const tenantId = await createTenantFixture("reacquire");
    const machineId = await createMachineFixture(tenantId, "reacquire");

    const first = await processMqttLive(tenantId, machineId, telemetry(1));
    const oldRow = await client.liveSession.findFirst({
      where: { tenantId, machineId, status: "ACTIVE" },
    });
    expect(oldRow).not.toBeNull();

    // Close the session before the next event arrives, simulating a session
    // completed between acquire and append.
    await client.liveSession.updateMany({
      where: { tenantId, machineId, status: "ACTIVE" },
      data: { status: "COMPLETED" },
    });

    const second = await processMqttLive(tenantId, machineId, telemetry(2));

    expect(second.sessionId).not.toBe(first.sessionId);
    expect(await activeCount(tenantId, machineId)).toBe(1);

    // The new event landed in the fresh ACTIVE session; the closed session
    // still holds only its own event — nothing was lost or double-stored.
    const activeRow = await client.liveSession.findFirst({
      where: { tenantId, machineId, status: "ACTIVE" },
    });
    const closedRow = await client.liveSession.findFirst({
      where: { id: oldRow!.id },
    });
    const seqs = (row: { events?: unknown } | null) =>
      ((row?.events as Array<{ data?: { seq?: number } }>) ?? []).map(
        (e) => e.data?.seq,
      );
    expect(seqs(activeRow)).toEqual([2]);
    expect(seqs(closedRow)).toEqual([1]);
  });

  it("more than one COMPLETED session can be stored for the same machine", async () => {
    const tenantId = await createTenantFixture("history");
    const machineId = await createMachineFixture(tenantId, "history");

    await processMqttLive(tenantId, machineId, telemetry(1));
    await client.liveSession.updateMany({
      where: { tenantId, machineId, status: "ACTIVE" },
      data: { status: "COMPLETED" },
    });

    await client.liveSession.create({
      data: {
        tenantId,
        machineId,
        sessionId: `done-${freshSuffix()}-a`,
        status: "COMPLETED",
      },
    });
    await client.liveSession.create({
      data: {
        tenantId,
        machineId,
        sessionId: `done-${freshSuffix()}-b`,
        status: "COMPLETED",
      },
    });

    expect(await activeCount(tenantId, machineId)).toBe(0);
    expect(
      await client.liveSession.count({
        where: { tenantId, machineId, status: "COMPLETED" },
      }),
    ).toBeGreaterThanOrEqual(2);
  });

  it("20 concurrent appends store exactly 20 events without loss or duplication", async () => {
    const tenantId = await createTenantFixture("append");
    const machineId = await createMachineFixture(tenantId, "append");
    const N = 20;

    await Promise.all(
      Array.from({ length: N }, (_, i) =>
        processMqttLive(tenantId, machineId, telemetry(i)),
      ),
    );

    const row = await client.liveSession.findFirst({
      where: { tenantId, machineId, status: "ACTIVE" },
    });
    expect(row).not.toBeNull();
    const events = (row?.events as Array<{
      data?: { seq?: number };
    }>) ?? [];

    expect(events.length).toBe(N);
    const seqs = events.map((e) => e.data?.seq).sort((a, b) => a! - b!);
    expect(seqs).toEqual(Array.from({ length: N }, (_, i) => i));
  });
});
