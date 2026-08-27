import { beforeEach, describe, expect, it } from "vitest";

import {
  decryptCredential,
  decryptCredentialWithSecret,
  encryptCredential,
  encryptCredentialWithSecret,
  isEncryptedCredential,
} from "./credentials";

describe("credential encryption", () => {
  beforeEach(() => {
    process.env.CREDENTIAL_ENCRYPTION_KEY =
      "test-credential-encryption-key-at-least-32-characters";
  });

  it("round-trips an encrypted credential", () => {
    const encrypted = encryptCredential("SB-Mid-server-secret");
    expect(isEncryptedCredential(encrypted)).toBe(true);
    expect(encrypted).not.toContain("SB-Mid-server-secret");
    expect(decryptCredential(encrypted)).toBe("SB-Mid-server-secret");
  });

  it("keeps legacy plaintext readable during migration", () => {
    expect(decryptCredential("legacy-plaintext")).toBe("legacy-plaintext");
  });

  it("does not encrypt an encrypted value twice", () => {
    const encrypted = encryptCredential("secret");
    expect(encryptCredential(encrypted)).toBe(encrypted);
  });

  it("supports an explicit key for credential rotation", () => {
    const encrypted = encryptCredentialWithSecret("secret", "old-secret");
    expect(decryptCredentialWithSecret(encrypted, "old-secret")).toBe("secret");
    expect(() => decryptCredentialWithSecret(encrypted, "new-secret")).toThrow();
  });
});
