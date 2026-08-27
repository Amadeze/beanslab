import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { sealData } from "iron-session";

import { SESSION_OPTIONS } from "../../src/lib/session";
import { getTenantAccessState } from "../../src/lib/subscription";

test("live telemetry only returns fresh source updates", async ({
  context,
  page,
}) => {
  test.skip(!process.env.DATABASE_URL, "DATABASE_URL is required.");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  let machineId: string | null = null;

  try {
    const owners = await prisma.user.findMany({
      where: {
        isActive: true,
        role: "OWNER",
        tenant: { isActive: true },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        tenantId: true,
        sessionVersion: true,
        tenant: {
          select: {
            isActive: true,
            subscriptionTier: true,
            subscriptionStatus: true,
            trialEndsAt: true,
            nextBillingDate: true,
          },
        },
      },
    });
    const owner = owners.find(
      (candidate) => getTenantAccessState(candidate.tenant) === "ACTIVE",
    );
    test.skip(!owner, "An active owner is required.");

    const user = {
      id: owner!.id,
      name: owner!.name,
      email: owner!.email,
      role: owner!.role,
      tenantId: owner!.tenantId,
      sessionVersion: owner!.sessionVersion,
    };
    const sessionCookie = await sealData(
      { user },
      {
        password: SESSION_OPTIONS.password,
        ttl: SESSION_OPTIONS.cookieOptions.maxAge,
      },
    );
    await context.addCookies([
      {
        name: SESSION_OPTIONS.cookieName,
        value: sessionCookie,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    const machine = await prisma.machine.create({
      data: {
        tenantId: user.tenantId,
        name: `E2E Telemetry ${suffix}`,
      },
    });
    machineId = machine.id;

    await prisma.liveSession.create({
      data: {
        tenantId: user.tenantId,
        machineId,
        sessionId: `stale-${suffix}`,
        status: "ACTIVE",
        lastUpdateAt: new Date(Date.now() - 60_000),
        currentBT: 120.9,
        currentET: 228.6,
      },
    });

    const staleResponse = await page.request.get(
      "/api/integrations/artisan/mqtt/live",
    );
    expect(staleResponse.ok()).toBeTruthy();
    const stalePayload = await staleResponse.json();
    expect(
      stalePayload.sessions.some(
        (session: { machineId: string }) => session.machineId === machineId,
      ),
    ).toBeFalsy();

    // Only one ACTIVE session may exist per machine (partial unique index
    // live_sessions_active_unique): close the stale one before opening a
    // fresh session for the same machine.
    await prisma.liveSession.updateMany({
      where: { tenantId: user.tenantId, machineId, status: "ACTIVE" },
      data: { status: "COMPLETED" },
    });

    await prisma.liveSession.create({
      data: {
        tenantId: user.tenantId,
        machineId,
        sessionId: `fresh-${suffix}`,
        status: "ACTIVE",
        lastUpdateAt: new Date(),
        currentBT: 121.4,
        currentET: 229.1,
      },
    });

    const freshResponse = await page.request.get(
      "/api/integrations/artisan/mqtt/live",
    );
    expect(freshResponse.ok()).toBeTruthy();
    const freshPayload = await freshResponse.json();
    expect(
      freshPayload.sessions.some(
        (session: { sessionId: string }) =>
          session.sessionId === `fresh-${suffix}`,
      ),
    ).toBeTruthy();
  } finally {
    if (machineId) {
      await prisma.liveSession.deleteMany({ where: { machineId } });
      await prisma.machine.deleteMany({ where: { id: machineId } });
    }
    await prisma.$disconnect();
  }
});
