import { describe, expect, it } from "vitest";
import {
  issueB2bAccessTokenWithSecret,
  verifyB2bAccessTokenWithSecret,
} from "./b2b-access";

const SECRET = "batch-eight-test-secret-that-is-at-least-32-chars";
const NOW = new Date("2026-08-22T00:00:00.000Z");

describe("B2B access tokens", () => {
  it("round-trips a tenant/customer-bound partner link", () => {
    const token = issueB2bAccessTokenWithSecret({
      tenantId: "tenant-a",
      customerId: "customer-a",
      expiresAt: new Date("2026-09-01T00:00:00.000Z"),
    }, SECRET, NOW);

    expect(verifyB2bAccessTokenWithSecret(token, SECRET, NOW)).toMatchObject({
      tenantId: "tenant-a",
      customerId: "customer-a",
    });
  });

  it("rejects tampering, another secret, and expired access", () => {
    const token = issueB2bAccessTokenWithSecret({ tenantId: "tenant-a", customerId: "customer-a" }, SECRET, NOW);
    expect(verifyB2bAccessTokenWithSecret(`${token}x`, SECRET, NOW)).toBeNull();
    expect(verifyB2bAccessTokenWithSecret(token, `${SECRET}-other`, NOW)).toBeNull();
    expect(verifyB2bAccessTokenWithSecret(token, SECRET, new Date("2026-10-01T00:00:00.000Z"))).toBeNull();
  });
});
