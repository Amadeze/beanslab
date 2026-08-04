import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { prisma } from "@/lib/prisma";
import { SESSION_OPTIONS, type SessionUser } from "@/lib/session";
import { POST } from "./route";

// Gated integration test: only runs against an isolated test DB with RUN_INTEGRATION=true.
const integrationEnabled = process.env.RUN_INTEGRATION === "true";
const suite = integrationEnabled ? describe : describe.skip;

// In-memory cookie jar standing in for next/headers cookies() so the real
// iron-session + getValidatedCurrentUser chain runs against real sessions.
const authEnv = vi.hoisted(() => {
  const store = new Map<string, string>();
  return {
    store,
    cookieStore: {
      get: (name: string) => {
        const value = store.get(name);
        return value === undefined ? undefined : { name, value };
      },
      set: (name: string, value: string) => {
        store.set(name, value);
      },
      delete: (name: string) => {
        store.delete(name);
      },
    },
  };
});

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => authEnv.cookieStore),
  headers: vi.fn(async () => ({})),
}));

// iron-session 8.x does not export its CookieStore type; mirror its shape.
interface CookieStoreLike {
  get(name: string): { name: string; value: string } | undefined;
  set: {
    (name: string, value: string, cookie?: unknown): void;
    (options: unknown): void;
  };
  delete(name: string): void;
}

const TENANT_A = "tenant-manual-a";
const TENANT_B = "tenant-manual-b";
const USER_A = "user-manual-a";
const USER_A_DISABLED = "user-manual-a-disabled";
const MACHINE_A_ACTIVE = "machine-manual-a-active";
const MACHINE_A_INACTIVE = "machine-manual-a-inactive";
const MACHINE_B = "machine-manual-b";
const CONNECTOR_MANUAL = "manual-upload";

const fixturesDir = join(process.cwd(), "src/lib/artisan/__tests__/fixtures");

suite("manual roasting upload machine ownership (integration)", () => {
  beforeAll(async () => {
    for (const [id, code, subdomain] of [
      [TENANT_A, "MNLA", "mnl-a"],
      [TENANT_B, "MNLB", "mnl-b"],
    ] as const) {
      await prisma.tenant.create({
        data: {
          id,
          code,
          name: `ManualUpload ${code}`,
          subdomain,
          subscriptionTier: "BASIC",
          subscriptionStatus: "ACTIVE",
          isActive: true,
        },
      });
    }

    await prisma.user.createMany({
      data: [
        { id: USER_A, tenantId: TENANT_A, email: "manual-a@example.com", name: "Manual A", role: "OWNER" },
        { id: USER_A_DISABLED, tenantId: TENANT_A, email: "manual-a-disabled@example.com", name: "Manual A2", role: "OWNER" },
      ],
    });

    await prisma.machine.createMany({
      data: [
        { id: MACHINE_A_ACTIVE, tenantId: TENANT_A, name: "Mesin A Aktif", isActive: true },
        { id: MACHINE_A_INACTIVE, tenantId: TENANT_A, name: "Mesin A Nonaktif", isActive: false },
        { id: MACHINE_B, tenantId: TENANT_B, name: "Mesin B", isActive: true },
      ],
    });

    // The route writes imports with connectorId "manual-upload", which is an
    // FK to roastd_studios.id; provide the fixture row the route expects.
    await prisma.roastdStudio.create({
      data: {
        id: CONNECTOR_MANUAL,
        tenantId: TENANT_A,
        machineId: MACHINE_A_ACTIVE,
        installationId: "00000000-0000-0000-0000-000000000000",
        computerName: "manual",
        platform: "web",
        appVersion: "1.0.0",
        credentialHash: "manual-upload",
        status: "ONLINE",
      },
    });
  });

  afterAll(async () => {
    await prisma.roast.deleteMany({
      where: { tenantId: { in: [TENANT_A, TENANT_B] } },
    });
    await prisma.artisanRoastImport.deleteMany({
      where: { tenantId: { in: [TENANT_A, TENANT_B] } },
    });
    await prisma.roastdStudio.deleteMany({
      where: { id: CONNECTOR_MANUAL },
    });
    await prisma.machine.deleteMany({
      where: { tenantId: { in: [TENANT_A, TENANT_B] } },
    });
    await prisma.user.deleteMany({
      where: { tenantId: { in: [TENANT_A, TENANT_B] } },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [TENANT_A, TENANT_B] } },
    });
  });

  async function loginAs(user: { id: string; tenantId: string; email: string; name: string }) {
    const session = await getIronSession<{ user?: SessionUser }>(
      authEnv.cookieStore as unknown as CookieStoreLike,
      SESSION_OPTIONS,
    );
    session.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: "OWNER",
      tenantId: user.tenantId,
      sessionVersion: 0,
    };
    await session.save();
  }

  async function upload(machineId: string | null, fixture: "sample-roast.alog" | "sweet-marias-real.alog") {
    const buffer = readFileSync(join(fixturesDir, fixture));
    const form = new FormData();
    if (machineId) form.append("machineId", machineId);
    form.append("file", new File([buffer], fixture));
    const req = new NextRequest("http://localhost/api/roasting/manual-upload", {
      method: "POST",
      body: form,
    });
    return POST(req);
  }

  function importCount(tenantId: string, machineId?: string): Promise<number> {
    return prisma.artisanRoastImport.count({
      where: machineId
        ? { tenantId, machineId }
        : { tenantId },
    });
  }

  it("accepts a machine owned by the caller's tenant", async () => {
    authEnv.store.clear();
    await loginAs({ id: USER_A, tenantId: TENANT_A, email: "manual-a@example.com", name: "Manual A" });
    const before = await importCount(TENANT_A);

    const res = await upload(MACHINE_A_ACTIVE, "sample-roast.alog");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const importRow = await prisma.artisanRoastImport.findFirst({
      where: { tenantId: TENANT_A, machineId: MACHINE_A_ACTIVE },
      orderBy: { uploadedAt: "desc" },
    });
    expect(importRow).not.toBeNull();
    expect(importRow?.tenantId).toBe(TENANT_A);
    expect(await importCount(TENANT_A)).toBe(before + 1);

    const roast = await prisma.roast.findUnique({
      where: { importId: importRow!.id },
    });
    expect(roast).not.toBeNull();
    expect(roast?.tenantId).toBe(TENANT_A);
    expect(roast?.machineId).toBe(MACHINE_A_ACTIVE);
  });

  it("rejects a machine owned by another tenant without writing anything", async () => {
    authEnv.store.clear();
    await loginAs({ id: USER_A, tenantId: TENANT_A, email: "manual-a@example.com", name: "Manual A" });
    const beforeA = await importCount(TENANT_A);
    const beforeB = await importCount(TENANT_B);
    const machineB = await prisma.machine.findUnique({ where: { id: MACHINE_B } });
    expect(machineB?.isActive).toBe(true);

    const res = await upload(MACHINE_B, "sample-roast.alog");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Mesin tidak ditemukan." });

    expect(await importCount(TENANT_A)).toBe(beforeA);
    expect(await importCount(TENANT_B)).toBe(beforeB);
    expect(
      await prisma.artisanRoastImport.count({ where: { machineId: MACHINE_B } }),
    ).toBe(0);
    expect(
      await prisma.roast.count({ where: { machineId: MACHINE_B } }),
    ).toBe(0);
  });

  it("rejects a nonexistent machine with the same response (no existence leak)", async () => {
    authEnv.store.clear();
    await loginAs({ id: USER_A, tenantId: TENANT_A, email: "manual-a@example.com", name: "Manual A" });
    const beforeA = await importCount(TENANT_A);
    const beforeB = await importCount(TENANT_B);

    const foreignRes = await upload(MACHINE_B, "sample-roast.alog");
    const missingRes = await upload("machine-never-exists", "sample-roast.alog");

    expect(foreignRes.status).toBe(404);
    expect(missingRes.status).toBe(404);
    await expect(foreignRes.json()).resolves.toEqual(
      await missingRes.json(),
    );

    expect(await importCount(TENANT_A)).toBe(beforeA);
    expect(await importCount(TENANT_B)).toBe(beforeB);
  });

  it("rejects a disabled machine of the caller's tenant", async () => {
    authEnv.store.clear();
    await loginAs({ id: USER_A, tenantId: TENANT_A, email: "manual-a@example.com", name: "Manual A" });

    const res = await upload(MACHINE_A_INACTIVE, "sample-roast.alog");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Mesin tidak ditemukan." });
  });

  it("rejects a disabled user before any machine processing", async () => {
    authEnv.store.clear();
    await loginAs({ id: USER_A_DISABLED, tenantId: TENANT_A, email: "manual-a-disabled@example.com", name: "Manual A2" });
    const before = await importCount(TENANT_A);

    // Active user reaches the handler (duplicate of test 1's file → 200, no row).
    const first = await upload(MACHINE_A_ACTIVE, "sample-roast.alog");
    expect(first.status).toBe(200);

    await prisma.user.update({ where: { id: USER_A_DISABLED }, data: { isActive: false } });

    const second = await upload(MACHINE_A_ACTIVE, "sample-roast.alog");
    expect(second.status).toBe(500);
    expect(await importCount(TENANT_A)).toBe(before);
  });

  it("never lets machineId change the write target tenant", async () => {
    authEnv.store.clear();
    await loginAs({ id: USER_A, tenantId: TENANT_A, email: "manual-a@example.com", name: "Manual A" });
    const beforeB = await importCount(TENANT_B);

    await upload(MACHINE_B, "sweet-marias-real.alog");

    expect(await importCount(TENANT_B)).toBe(beforeB);
    expect(
      await prisma.artisanRoastImport.count({
        where: { machineId: MACHINE_B },
      }),
    ).toBe(0);
  });

  it("creates no roast or import when ownership fails", async () => {
    authEnv.store.clear();
    await loginAs({ id: USER_A, tenantId: TENANT_A, email: "manual-a@example.com", name: "Manual A" });
    const beforeImports = await importCount(TENANT_A);
    const beforeRoasts = await prisma.roast.count({ where: { tenantId: TENANT_A } });

    await upload(MACHINE_B, "sweet-marias-real.alog");
    await upload("machine-never-exists", "sweet-marias-real.alog");
    await upload(MACHINE_A_INACTIVE, "sweet-marias-real.alog");

    expect(await importCount(TENANT_A)).toBe(beforeImports);
    expect(await prisma.roast.count({ where: { tenantId: TENANT_A } })).toBe(beforeRoasts);
    expect(
      await prisma.artisanRoastImport.count({ where: { machineId: MACHINE_B } }),
    ).toBe(0);
  });

  it("fallback without machineId only uses the caller's active machine", async () => {
    authEnv.store.clear();
    await loginAs({ id: USER_A, tenantId: TENANT_A, email: "manual-a@example.com", name: "Manual A" });
    const before = await importCount(TENANT_A);

    const res = await upload(null, "sweet-marias-real.alog");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const importRow = await prisma.artisanRoastImport.findFirst({
      where: { tenantId: TENANT_A },
      orderBy: { uploadedAt: "desc" },
    });
    expect(importRow).not.toBeNull();
    expect(importRow?.machineId).toBe(MACHINE_A_ACTIVE);
    expect(importRow?.tenantId).toBe(TENANT_A);
    expect(await importCount(TENANT_A)).toBe(before + 1);
  });
});
