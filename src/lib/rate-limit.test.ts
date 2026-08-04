import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const { upsertMock } = vi.hoisted(() => ({ upsertMock: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: { rateLimitBucket: { upsert: upsertMock } },
}));

import { enforceRateLimit, RateLimitError, RateLimitMisconfigurationError } from "./rate-limit";
import {
  UNTRUSTED_IDENTITY,
  digestIdentifier,
  emailIdentifier,
  isPlausibleIp,
  layeredIdentifiers,
  networkIdentifier,
  normalizeEmail,
  normalizePhone,
  parseForwardedChain,
  phoneIdentifier,
  resolveClientIdentity,
  tenantIdentifier,
  userIdentifier,
} from "./client-identity";

function headersWith(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

function restoreEnv() {
  delete process.env.VERCEL;
  delete process.env.TRUST_PROXY;
  delete process.env.TRUSTED_PROXY_HOPS;
}

describe("client identity — untrusted environment", () => {
  afterEach(restoreEnv);

  it("1. spoofed X-Forwarded-For does not change identity when untrusted", () => {
    restoreEnv();
    const identity = resolveClientIdentity(
      headersWith({ "x-forwarded-for": "203.0.113.66", "x-real-ip": "198.51.100.7" }),
    );
    expect(identity).toEqual(UNTRUSTED_IDENTITY);
    expect(identity.trusted).toBe(false);
    expect(identity.ip).toBeNull();
    expect(networkIdentifier(identity)).toBeNull();
  });

  it("2. malformed header is rejected as a whole (all-or-nothing chain)", () => {
    expect(parseForwardedChain("garbage, , 999.999.1.1, not-an-ip, unknown")).toEqual([]);
    // A single broken entry invalidates the entire chain — entries are never
    // dropped before trusted-hop counting.
    expect(parseForwardedChain("10.0.0.1, 1.2.3.4.5.6, 256.1.1.1")).toEqual([]);
    expect(parseForwardedChain("::ffff:192.0.2.1, ::1")).toEqual([
      "::ffff:192.0.2.1",
      "::1",
    ]);
    expect(isPlausibleIp("unknown")).toBe(false);
    expect(isPlausibleIp("untrusted")).toBe(false);
    expect(isPlausibleIp("")).toBe(false);
    expect(isPlausibleIp("203.0.113.66")).toBe(true);
    expect(isPlausibleIp("2001:db8::1")).toBe(true);
  });

  it("6. self-hosted without trusted proxy config ignores forwarded headers", () => {
    restoreEnv();
    expect(resolveClientIdentity(headersWith({ "x-forwarded-for": "203.0.113.9" }))).toEqual(
      UNTRUSTED_IDENTITY,
    );
    expect(resolveClientIdentity(headersWith({}))).toEqual(UNTRUSTED_IDENTITY);
  });

  it("13. no random per-request identifier is invented for untrusted identity", () => {
    restoreEnv();
    const identity = resolveClientIdentity(headersWith({ "x-forwarded-for": "198.51.100.4" }));
    expect(identity.ip).toBeNull();
    expect(networkIdentifier(identity)).toBeNull();
    // Two calls from the "same" client must not produce distinct buckets.
    expect(networkIdentifier(resolveClientIdentity(headersWith({})))).toBeNull();
    expect(networkIdentifier(resolveClientIdentity(headersWith({})))).toBeNull();
  });

  it("14. no global 'untrusted'/'unknown' bucket is ever emitted", () => {
    restoreEnv();
    const identity = resolveClientIdentity(headersWith({}));
    const ids = layeredIdentifiers(identity, [emailIdentifier("a@example.com")]);
    expect(ids).toEqual(["email:a@example.com"]);
    expect(ids.some((id) => id.includes("unknown") || id.includes("untrusted"))).toBe(false);
    expect(networkIdentifier(UNTRUSTED_IDENTITY)).toBeNull();
  });
});

describe("client identity — Vercel runtime", () => {
  afterEach(restoreEnv);

  it("4. Vercel trusts only its own x-vercel-forwarded-for header", () => {
    process.env.VERCEL = "1";
    const identity = resolveClientIdentity(
      headersWith({ "x-vercel-forwarded-for": "203.0.113.20, 10.0.0.2" }),
    );
    expect(identity).toEqual({ ip: "203.0.113.20", trusted: true, provider: "vercel" });
  });

  it("Vercel ignores x-forwarded-for and x-real-ip even when present", () => {
    process.env.VERCEL = "1";
    const spoofed = resolveClientIdentity(
      headersWith({
        "x-forwarded-for": "203.0.113.66",
        "x-real-ip": "198.51.100.7",
        "x-vercel-forwarded-for": "10.0.0.2",
      }),
    );
    expect(spoofed.ip).toBe("10.0.0.2");
    const withoutVercelHeader = resolveClientIdentity(
      headersWith({ "x-forwarded-for": "203.0.113.66", "x-real-ip": "198.51.100.7" }),
    );
    expect(withoutVercelHeader.trusted).toBe(false);
    expect(withoutVercelHeader.ip).toBeNull();
    const malformed = resolveClientIdentity(
      headersWith({ "x-vercel-forwarded-for": "garbage, 10.0.0.2" }),
    );
    expect(malformed.trusted).toBe(false);
    expect(malformed.ip).toBeNull();
  });
});

describe("client identity — trusted reverse proxy (self-hosted)", () => {
  afterEach(restoreEnv);

  it("5. TRUST_PROXY=true makes forwarded headers trusted", () => {
    process.env.TRUST_PROXY = "true";
    const identity = resolveClientIdentity(
      headersWith({ "x-forwarded-for": "203.0.113.55" }),
    );
    expect(identity).toEqual({ ip: "203.0.113.55", trusted: true, provider: "trusted-proxy" });
  });

  it("3. proxy chain picks the entry hops away from the right edge", () => {
    process.env.TRUST_PROXY = "1";
    process.env.TRUSTED_PROXY_HOPS = "2";
    const identity = resolveClientIdentity(
      headersWith({ "x-forwarded-for": "203.0.113.1, 198.51.100.2, 10.0.0.3" }),
    );
    expect(identity.ip).toBe("198.51.100.2");
  });

  it("a single malformed entry invalidates the whole trusted chain", () => {
    process.env.TRUST_PROXY = "1";
    process.env.TRUSTED_PROXY_HOPS = "2";
    const identity = resolveClientIdentity(
      headersWith({ "x-forwarded-for": "203.0.113.1, garbage, 198.51.100.2" }),
    );
    expect(identity.trusted).toBe(false);
    expect(identity.ip).toBeNull();
    expect(networkIdentifier(identity)).toBeNull();
  });

  it("falls back to x-real-ip when the chain is shorter than the hop count", () => {
    process.env.TRUST_PROXY = "1";
    process.env.TRUSTED_PROXY_HOPS = "3";
    // A chain shorter than the declared hops is NOT trusted (entries may be
    // client-supplied); x-real-ip written by the proxy is used instead.
    const viaChain = resolveClientIdentity(headersWith({ "x-forwarded-for": "203.0.113.1" }));
    expect(viaChain.trusted).toBe(false);
    expect(viaChain.ip).toBeNull();
    const viaRealIp = resolveClientIdentity(
      headersWith({ "x-forwarded-for": "203.0.113.1", "x-real-ip": "198.51.100.9" }),
    );
    expect(viaRealIp.ip).toBe("198.51.100.9");
  });

  it("hop count config is ignored when TRUST_PROXY is not set", () => {
    restoreEnv();
    process.env.TRUSTED_PROXY_HOPS = "2";
    expect(resolveClientIdentity(headersWith({ "x-forwarded-for": "203.0.113.1" }))).toEqual(
      UNTRUSTED_IDENTITY,
    );
  });
});

describe("normalization and layered identifiers", () => {
  afterEach(restoreEnv);

  it("7. email normalization is case-insensitive and trimmed", () => {
    expect(normalizeEmail("  User@Example.COM ")).toBe("user@example.com");
    expect(emailIdentifier(" User@Example.COM ")).toBe(emailIdentifier("user@example.com"));
  });

  it("8. phone normalization keeps digits only", () => {
    expect(normalizePhone("+62 812-3456-7890")).toBe("6281234567890");
    expect(normalizePhone("(021) 555 0100")).toBe("0215550100");
    expect(phoneIdentifier("+62 812-3456")).toBe(phoneIdentifier("628123456"));
  });

  it("9. same account from different IPs keeps the same account bucket", () => {
    const a = layeredIdentifiers(
      { ip: "203.0.113.1", trusted: true, provider: "vercel" as const },
      [emailIdentifier("owner@roastery.example")],
    );
    const b = layeredIdentifiers(
      { ip: "198.51.100.9", trusted: true, provider: "vercel" as const },
      [emailIdentifier("OWNER@Roastery.Example")],
    );
    expect(a[1]).toBe(b[1]);
    expect(a[0]).not.toBe(b[0]);
  });

  it("10. same IP with different accounts splits account buckets", () => {
    const base = { ip: "203.0.113.1", trusted: true, provider: "vercel" as const };
    const a = layeredIdentifiers(base, [emailIdentifier("a@example.com")]);
    const b = layeredIdentifiers(base, [emailIdentifier("b@example.com")]);
    expect(a[0]).toBe(b[0]);
    expect(a[1]).not.toBe(b[1]);
  });

  it("11. different tenants do not share buckets", () => {
    expect(tenantIdentifier("tenant-a")).not.toBe(tenantIdentifier("tenant-b"));
    expect(userIdentifier("user-a")).not.toBe(userIdentifier("user-b"));
  });

  it("digest identifiers hide raw secrets", () => {
    const token = "sup3r-secret-reset-token";
    const id = digestIdentifier("reset-token", token);
    expect(id).toMatch(/^reset-token:[0-9a-f]{64}$/);
    expect(id).not.toContain(token);
  });
});

describe("enforceRateLimit — layered identifiers", () => {
  beforeEach(() => {
    upsertMock.mockReset();
  });

  it("enforces each layer with its own bucket and hashed keys", async () => {
    const counts = new Map<string, number>();
    upsertMock.mockImplementation(async ({ where, create, update, select }) => {
      const current = (counts.get(where.key) ?? 0) + 1;
      counts.set(where.key, current);
      return { count: current };
    });

    await enforceRateLimit({
      scope: "login",
      identifiers: ["net:203.0.113.1", "email:user@example.com"],
      limit: 5,
      windowSeconds: 60,
    });

    expect(upsertMock).toHaveBeenCalledTimes(2);
    const keys = upsertMock.mock.calls.map((call) => call[0].where.key);
    for (const key of keys) {
      expect(key).toMatch(/^login:[0-9a-f]{64}:\d+$/);
    }
    expect(keys[0]).not.toBe(keys[1]);
  });

  it("12. bucket keys never contain raw PII or tokens", async () => {
    const rawEmail = "victim@secret-domain.example";
    const rawPhone = "+62 812-0000-9999";
    const rawToken = "t0k3n-r4w-v4lu3";
    upsertMock.mockResolvedValue({ count: 1 });

    await enforceRateLimit({
      scope: "register",
      identifiers: [emailIdentifier(rawEmail), phoneIdentifier(rawPhone), digestIdentifier("t", rawToken)],
      limit: 5,
      windowSeconds: 60,
    });

    for (const call of upsertMock.mock.calls) {
      const key = call[0].where.key;
      expect(key).not.toContain(rawEmail);
      expect(key).not.toContain("secret-domain");
      expect(key).not.toContain(rawPhone);
      expect(key).not.toContain("6281200009999");
      expect(key).not.toContain(rawToken);
    }
  });

  it("rejects when any single layer exceeds its limit", async () => {
    const counts = new Map<string, number>();
    upsertMock.mockImplementation(async ({ where, update }) => {
      const current = (counts.get(where.key) ?? 0) + 1;
      counts.set(where.key, current);
      return { count: current };
    });

    const identifiers = ["net:203.0.113.1", "email:a@example.com"];
    for (let i = 0; i < 5; i++) {
      await enforceRateLimit({ scope: "login", identifiers, limit: 5, windowSeconds: 60 });
    }
    await expect(
      enforceRateLimit({ scope: "login", identifiers, limit: 5, windowSeconds: 60 }),
    ).rejects.toBeInstanceOf(RateLimitError);
  });

  it("fails closed with a controlled error when identifiers is empty", async () => {
    await expect(
      enforceRateLimit({ scope: "studio:device-start", identifiers: [], limit: 8, windowSeconds: 60 }),
    ).rejects.toBeInstanceOf(RateLimitMisconfigurationError);
    await expect(
      enforceRateLimit({ scope: "studio:device-start", identifiers: [], limit: 8, windowSeconds: 60 }),
    ).rejects.toThrow(/studio:device-start/);
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
