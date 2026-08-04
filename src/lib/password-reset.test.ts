import { describe, expect, it, vi } from "vitest";

import {
  consumePasswordResetToken,
  createPasswordResetToken,
  hashPasswordResetToken,
} from "./password-reset";

describe("password reset tokens", () => {
  it("creates high-entropy URL-safe tokens", () => {
    const first = createPasswordResetToken();
    const second = createPasswordResetToken();
    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(first.length).toBeGreaterThanOrEqual(40);
  });

  it("hashes tokens deterministically without storing the raw token", () => {
    const hash = hashPasswordResetToken("token-value");
    expect(hash).toBe(hashPasswordResetToken("token-value"));
    expect(hash).not.toContain("token-value");
  });

  it("claims a reset token before changing the password", async () => {
    const tx = {
      passwordResetToken: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      user: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: "audit-1" }),
      },
    };
    await consumePasswordResetToken(tx, {
      tokenId: "token-1",
      userId: "user-1",
      tenantId: "tenant-1",
      passwordHash: "hash",
      now: new Date("2026-07-16T00:00:00Z"),
    });
    expect(tx.passwordResetToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ usedAt: null }),
      }),
    );
    expect(tx.user.updateMany).toHaveBeenCalledOnce();
  });

  it("bumps the session version together with the password hash", async () => {
    const tx = {
      passwordResetToken: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      user: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: "audit-1" }),
      },
    };
    await consumePasswordResetToken(tx, {
      tokenId: "token-1",
      userId: "user-1",
      tenantId: "tenant-1",
      passwordHash: "hash",
    });
    expect(tx.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "user-1", isActive: true }),
        data: {
          password: "hash",
          sessionVersion: { increment: 1 },
        },
      }),
    );
  });

  it("does not update the user when the token was already claimed", async () => {
    const tx = {
      passwordResetToken: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      user: { updateMany: vi.fn() },
    };
    await expect(consumePasswordResetToken(tx, {
      tokenId: "token-1",
      userId: "user-1",
      tenantId: "tenant-1",
      passwordHash: "hash",
    })).rejects.toThrow("RESET_TOKEN_ALREADY_USED");
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });

  it("aborts without auditing when the user cannot be updated", async () => {
    const tx = {
      passwordResetToken: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      user: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      auditLog: { create: vi.fn() },
    };
    await expect(consumePasswordResetToken(tx, {
      tokenId: "token-1",
      userId: "user-1",
      tenantId: "tenant-1",
      passwordHash: "hash",
    })).rejects.toThrow("RESET_USER_INACTIVE");
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});
