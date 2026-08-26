import { describe, expect, it, vi } from "vitest";

import {
  consumeEmailVerificationToken,
  createEmailVerificationToken,
  hashEmailVerificationToken,
} from "./email-verification";

function buildTx(overrides: {
  claimCount?: number;
  userUpdateCount?: number;
  tokenRow?: any;
  userRow?: any;
} = {}) {
  return {
    emailVerificationToken: {
      updateMany: vi.fn().mockResolvedValue({ count: overrides.claimCount ?? 1 }),
      findUnique: vi.fn().mockResolvedValue(
        overrides.tokenRow ?? { id: "token-1", userId: "user-1" },
      ),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    user: {
      updateMany: vi.fn().mockResolvedValue({ count: overrides.userUpdateCount ?? 1 }),
      findUnique: vi.fn().mockResolvedValue(
        overrides.userRow ?? { isActive: true, emailVerifiedAt: null },
      ),
    },
  };
}

describe("email verification tokens", () => {
  it("creates high-entropy URL-safe tokens", () => {
    const first = createEmailVerificationToken();
    const second = createEmailVerificationToken();
    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(first.length).toBeGreaterThanOrEqual(40);
  });

  it("hashes tokens deterministically without storing the raw token", () => {
    const hash = hashEmailVerificationToken("token-value");
    expect(hash).toBe(hashEmailVerificationToken("token-value"));
    expect(hash).not.toContain("token-value");
  });

  it("claims the token atomically, marks the user verified, and removes sibling tokens", async () => {
    const tx = buildTx();
    const userId = await consumeEmailVerificationToken(tx, {
      tokenId: "token-1",
      now: new Date("2026-08-26T00:00:00Z"),
    });
    expect(userId).toBe("user-1");

    // Single-use: hanya klaim bila belum dipakai dan belum kedaluwarsa.
    expect(tx.emailVerificationToken.updateMany).toHaveBeenCalledWith({
      where: {
        id: "token-1",
        usedAt: null,
        expiresAt: { gt: new Date("2026-08-26T00:00:00Z") },
      },
      data: { usedAt: new Date("2026-08-26T00:00:00Z") },
    });

    // Verifikasi hanya untuk akun aktif yang belum terverifikasi.
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-1", isActive: true, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date("2026-08-26T00:00:00Z") },
    });

    expect(tx.emailVerificationToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", id: { not: "token-1" } },
    });
  });

  it("rejects a token that was already claimed or expired", async () => {
    const tx = buildTx({ claimCount: 0 });
    await expect(
      consumeEmailVerificationToken(tx, { tokenId: "token-1" }),
    ).rejects.toThrow("VERIFICATION_TOKEN_INVALID");
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });

  it("reports ALREADY_VERIFIED when another verification landed first", async () => {
    const tx = buildTx({ userUpdateCount: 0, userRow: { isActive: true, emailVerifiedAt: new Date() } });
    await expect(
      consumeEmailVerificationToken(tx, { tokenId: "token-1" }),
    ).rejects.toThrow("ALREADY_VERIFIED");
  });

  it("reports USER_INACTIVE without marking anything verified", async () => {
    const tx = buildTx({ userUpdateCount: 0, userRow: { isActive: false, emailVerifiedAt: null } });
    await expect(
      consumeEmailVerificationToken(tx, { tokenId: "token-1" }),
    ).rejects.toThrow("USER_INACTIVE");
  });
});
