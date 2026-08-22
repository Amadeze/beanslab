import { afterAll, beforeAll, describe, expect, it, vi, beforeEach } from "vitest";

const {
  mockFindUnique,
  mockDecrypt,
  mockEncrypt,
} = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockDecrypt: vi.fn((v: string) => (v.startsWith("enc:") ? v.replace("enc:", "") : v)),
  mockEncrypt: vi.fn((v: string) => `enc:${v}`),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    platformIntegration: { findUnique: mockFindUnique },
  },
}));

vi.mock("@/lib/credentials", () => ({
  decryptCredential: mockDecrypt,
  encryptCredential: mockEncrypt,
  isEncryptedCredential: (v: string) => typeof v === "string" && v.startsWith("enc:"),
}));

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(async () => ({ id: "u1", tenantId: "t1", role: "OWNER" as const })),
  requireTenantPrisma: vi.fn(async () => ({})),
}));

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: vi.fn(async () => ({ remaining: 10, resetAt: new Date() })),
  RateLimitError: class RateLimitError extends Error {
    retryAfter = 1;
    constructor() {
      super("rl");
      this.name = "RateLimitError";
    }
  },
}));

const { POST } = await import("./route");

beforeAll(() => {
  vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", "origin-search-route-test-secret");
});

afterAll(() => {
  vi.unstubAllEnvs();
});

global.fetch = vi.fn();

function makeRequest(query: string): any {
  return {
    headers: new Headers(),
    json: async () => ({ query }),
  };
}

async function readJson(response: Response) {
  return { status: response.status, body: await response.json() };
}

describe("tenant shipping origin-search route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockReset();
    mockDecrypt.mockReset();
    mockEncrypt.mockReset();
    mockDecrypt.mockImplementation((v: string) => (v.startsWith("enc:") ? v.replace("enc:", "") : v));
    mockEncrypt.mockImplementation((v: string) => `enc:${v}`);
    (global.fetch as any).mockReset();
  });

  it("rejects a short query with 400", async () => {
    const res = await POST(makeRequest("ya"));
    const { status, body } = await readJson(res);
    expect(status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns normalized destinations for a valid query", async () => {
    mockFindUnique.mockResolvedValueOnce({
      provider: "RAJAONGKIR",
      encryptedApiKey: "enc:platform-secret",
      isActive: true,
    });
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        code: 200,
        data: [
          {
            id: "574",
            province: "DKI Jakarta",
            city: "Jakarta Selatan",
            district: "Cilandak",
            subdistrict: "Cipete Selatan",
            postal_code: "12410",
          },
        ],
      }),
    });

    const res = await POST(makeRequest("Cilandak"));
    const { status, body } = await readJson(res);
    expect(status).toBe(200);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].providerId).toBe("574");
    expect(JSON.stringify(body)).not.toContain("platform-secret");
    const call = (global.fetch as any).mock.calls[0];
    expect(call[1].headers.key).toBe("platform-secret");
  });

  it("returns integrationDisabled when the platform integration is inactive", async () => {
    mockFindUnique.mockResolvedValueOnce({
      provider: "RAJAONGKIR",
      encryptedApiKey: "enc:platform-secret",
      isActive: false,
    });

    const res = await POST(makeRequest("Jakarta"));
    const { status, body } = await readJson(res);
    expect(status).toBe(200);
    expect(body.integrationDisabled).toBe(true);
    expect(body.results).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns a controlled error (no key) when the provider is unavailable", async () => {
    mockFindUnique.mockResolvedValueOnce({
      provider: "RAJAONGKIR",
      encryptedApiKey: "enc:platform-secret",
      isActive: true,
    });
    (global.fetch as any).mockResolvedValueOnce({ ok: false, status: 503 });

    const res = await POST(makeRequest("Jakarta"));
    const { status, body } = await readJson(res);
    expect(status).toBe(200);
    expect(body.error).toBe("PROVIDER_SERVER_ERROR");
    expect(JSON.stringify(body)).not.toContain("platform-secret");
  });
});
