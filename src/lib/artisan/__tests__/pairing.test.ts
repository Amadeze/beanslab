import { describe, expect, it } from "vitest";
import {
  generatePairingCode,
  hashPairingCode,
  generateConnectorToken,
  hashConnectorToken,
  generateStudioDeviceCode,
  generateStudioVerificationCode,
  hashStudioDeviceCode,
  hashStudioVerificationCode,
} from "../connector-auth";

describe("Artisan pairing code", () => {
  it("generates 6-digit numeric code", () => {
    const code = generatePairingCode();
    expect(code).toMatch(/^\d{6}$/);
    expect(code.length).toBe(6);
  });

  it("generates unique codes", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      codes.add(generatePairingCode());
    }
    // Should have high uniqueness (not guaranteed 100% but very likely)
    expect(codes.size).toBeGreaterThan(95);
  });

  it("hashes pairing code consistently", () => {
    const code = "123456";
    const hash1 = hashPairingCode(code);
    const hash2 = hashPairingCode(code);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
  });

  it("produces different hashes for different codes", () => {
    const hash1 = hashPairingCode("123456");
    const hash2 = hashPairingCode("654321");
    expect(hash1).not.toBe(hash2);
  });
});

describe("Artisan connector token", () => {
  it("generates 64-char hex token", () => {
    const token = generateConnectorToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(token.length).toBe(64);
  });

  it("generates unique tokens", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateConnectorToken());
    }
    expect(tokens.size).toBe(100);
  });

  it("hashes connector token consistently", () => {
    const token = generateConnectorToken();
    const hash1 = hashConnectorToken(token);
    const hash2 = hashConnectorToken(token);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces different hashes for different tokens", () => {
    const token1 = generateConnectorToken();
    const token2 = generateConnectorToken();
    const hash1 = hashConnectorToken(token1);
    const hash2 = hashConnectorToken(token2);
    expect(hash1).not.toBe(hash2);
  });
});

describe("Roastd Studio browser authorization", () => {
  it("uses separate high-entropy secrets for desktop polling and browser approval", () => {
    const deviceCode = generateStudioDeviceCode();
    const verificationCode = generateStudioVerificationCode();

    expect(deviceCode.length).toBeGreaterThanOrEqual(40);
    expect(verificationCode.length).toBeGreaterThanOrEqual(30);
    expect(deviceCode).not.toBe(verificationCode);
    expect(hashStudioDeviceCode(deviceCode)).not.toBe(hashStudioVerificationCode(deviceCode));
  });

  it("hashes device authorization secrets consistently", () => {
    const deviceCode = generateStudioDeviceCode();
    const verificationCode = generateStudioVerificationCode();

    expect(hashStudioDeviceCode(deviceCode)).toBe(hashStudioDeviceCode(deviceCode));
    expect(hashStudioVerificationCode(verificationCode)).toBe(hashStudioVerificationCode(verificationCode));
  });
});
