import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getIronSession } from "iron-session";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { SESSION_OPTIONS, type SessionUser } from "@/lib/session";
import { validateSessionUser } from "@/lib/auth";
import { loginAction } from "@/app/login/actions";
import { resetPassword } from "@/app/reset-password/actions";
import {
  createPasswordResetToken,
  hashPasswordResetToken,
} from "@/lib/password-reset";

// Gated integration test: only runs against an isolated test DB with RUN_INTEGRATION=true.
const integrationEnabled = process.env.RUN_INTEGRATION === "true";
const suite = integrationEnabled ? describe : describe.skip;

// In-memory cookie jar standing in for next/headers cookies() so the real
// iron-session flow (login writes a sealed cookie, tests read it back) runs.
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
vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return {
    ...actual,
    enforceRateLimit: vi.fn().mockResolvedValue(undefined),
  };
});

const TENANT_A = "tenant-sv-a";
const TENANT_B = "tenant-sv-b";

// iron-session 8.x does not export its CookieStore type; mirror its shape.
interface CookieStoreLike {
  get(name: string): { name: string; value: string } | undefined;
  set: {
    (name: string, value: string, cookie?: unknown): void;
    (options: unknown): void;
  };
  delete(name: string): void;
}

suite("session invalidation after password changes (integration)", () => {
  let userCounter = 0;

  beforeAll(async () => {
    for (const [id, code, subdomain] of [
      [TENANT_A, "SVA", "sv-a"],
      [TENANT_B, "SVB", "sv-b"],
    ] as const) {
      await prisma.tenant.upsert({
        where: { id },
        create: {
          id,
          code,
          name: `SessionVersion Tenant ${code}`,
          subdomain,
          subscriptionTier: "BASIC",
          subscriptionStatus: "ACTIVE",
          isActive: true,
        },
        update: {},
      });
    }
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { tenantId: { in: [TENANT_A, TENANT_B] } },
    });
    await prisma.user.deleteMany({
      where: { tenantId: { in: [TENANT_A, TENANT_B] } },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [TENANT_A, TENANT_B] } },
    });
  });

  async function createUser(options: { tenantId?: string; role?: string } = {}) {
    userCounter += 1;
    const email = `sv-user-${userCounter}@example.com`;
    const passwordHash = await bcrypt.hash("OldPass123", 4);
    return prisma.user.create({
      data: {
        tenantId: options.tenantId ?? TENANT_A,
        name: `User ${userCounter}`,
        email,
        password: passwordHash,
        role: options.role === "CASHIER" ? "CASHIER" : "OWNER",
      },
    });
  }

  function sessionFor(user: {
    id: string;
    name: string;
    email: string;
    role: string;
    tenantId: string;
    sessionVersion: number;
  }): SessionUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as SessionUser["role"],
      tenantId: user.tenantId,
      sessionVersion: user.sessionVersion,
    };
  }

  async function createResetToken(userId: string): Promise<string> {
    const token = createPasswordResetToken();
    await prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash: hashPasswordResetToken(token),
        expiresAt: new Date(Date.now() + 30 * 60 * 1_000),
      },
    });
    return token;
  }

  async function readSession(): Promise<SessionUser | undefined> {
    const session = await getIronSession<{ user?: SessionUser }>(
      authEnv.cookieStore as unknown as CookieStoreLike,
      SESSION_OPTIONS,
    );
    return session.user;
  }

  it("accepts a session issued before the password changes", async () => {
    const user = await createUser();
    const result = await validateSessionUser(sessionFor(user));
    expect(result).not.toBeNull();
    expect(result?.id).toBe(user.id);
    expect(result?.sessionVersion).toBe(0);
  });

  it("rejects the old session after a password reset", async () => {
    const user = await createUser();
    const token = await createResetToken(user.id);

    const res = await resetPassword(token, "NewPass456");
    expect(res.success).toBe(true);

    expect(await validateSessionUser(sessionFor(user))).toBeNull();
    const fresh = await prisma.user.findUnique({
      where: { id: user.id },
      select: { sessionVersion: true },
    });
    expect(fresh?.sessionVersion).toBe(1);
  });

  it("issues a valid session when logging in with the new password", async () => {
    const user = await createUser();
    const token = await createResetToken(user.id);
    await resetPassword(token, "NewPass456");
    expect((await resetPassword(token, "AnotherPass789")).success).toBe(false);

    authEnv.store.clear();
    const login = await loginAction(user.email, "NewPass456");
    expect(login.success).toBe(true);

    const sessionUser = await readSession();
    expect(sessionUser?.sessionVersion).toBe(1);
    expect(sessionUser && (await validateSessionUser(sessionUser))).not.toBeNull();
  });

  it("rejects the old password after a reset", async () => {
    const user = await createUser();
    const token = await createResetToken(user.id);
    await resetPassword(token, "NewPass456");

    authEnv.store.clear();
    const oldLogin = await loginAction(user.email, "OldPass123");
    expect(oldLogin.success).toBe(false);

    authEnv.store.clear();
    const newLogin = await loginAction(user.email, "NewPass456");
    expect(newLogin.success).toBe(true);
  });

  it("does not allow a reset token to be used twice", async () => {
    const user = await createUser();
    const token = await createResetToken(user.id);

    const first = await resetPassword(token, "NewPass456");
    expect(first.success).toBe(true);

    const second = await resetPassword(token, "AnotherPass789");
    expect(second.success).toBe(false);
    expect(second.message).toContain("Tautan reset sudah tidak berlaku");

    const used = await prisma.passwordResetToken.count({
      where: { userId: user.id, usedAt: { not: null } },
    });
    expect(used).toBe(1);
  });

  it("keeps other users' sessions valid after a password reset", async () => {
    const userA = await createUser();
    const userB = await createUser();
    const token = await createResetToken(userA.id);
    await resetPassword(token, "NewPass456");

    const bSession = sessionFor(userB);
    expect(await validateSessionUser(bSession)).toMatchObject({ id: userB.id });
    const freshB = await prisma.user.findUnique({
      where: { id: userB.id },
      select: { sessionVersion: true },
    });
    expect(freshB?.sessionVersion).toBe(0);
  });

  it("rejects a session with a stale version even while the cookie is valid", async () => {
    const user = await createUser();
    const token = await createResetToken(user.id);
    await resetPassword(token, "NewPass456");

    const stale = sessionFor({ ...user, sessionVersion: 0 });
    expect(await validateSessionUser(stale)).toBeNull();

    const current = sessionFor({ ...user, sessionVersion: 1 });
    expect(await validateSessionUser(current)).not.toBeNull();
  });

  it("keeps role, tenant, and isActive revalidation working", async () => {
    const user = await createUser();

    await prisma.user.update({ where: { id: user.id }, data: { role: "CASHIER" } });
    expect((await validateSessionUser(sessionFor(user)))?.role).toBe("CASHIER");

    expect(
      await validateSessionUser(sessionFor({ ...user, tenantId: TENANT_B })),
    ).toBeNull();

    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    expect(await validateSessionUser(sessionFor(user))).toBeNull();
  });
});
