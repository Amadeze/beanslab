import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockDecrypt, mockEncrypt, mockFindUnique, mockUpsert } = vi.hoisted(() => ({
  mockDecrypt: vi.fn((v: string) => (v.startsWith("enc:") ? v.replace("enc:", "") : v)),
  mockEncrypt: vi.fn((v: string) => `enc:${v}`),
  mockFindUnique: vi.fn(),
  mockUpsert: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    platformIntegration: {
      findUnique: mockFindUnique,
      upsert: mockUpsert,
    },
  },
}));

vi.mock("@/lib/credentials", () => ({
  decryptCredential: mockDecrypt,
  encryptCredential: mockEncrypt,
  isEncryptedCredential: (v: string) => typeof v === "string" && v.startsWith("enc:"),
}));

const {
  getRajaOngkirIntegrationState,
  getRajaOngkirClientConfig,
  upsertRajaOngkirApiKey,
  recordRajaOngkirConnectionResult,
  maskApiKey,
} = await import("./platform-integration");

describe("platform-integration secret safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockReset();
    mockUpsert.mockReset();
    mockDecrypt.mockReset();
    mockEncrypt.mockReset();
    mockDecrypt.mockImplementation((v: string) => (v.startsWith("enc:") ? v.replace("enc:", "") : v));
    mockEncrypt.mockImplementation((v: string) => `enc:${v}`);
  });

  describe("maskApiKey", () => {
    it("masks short keys entirely", () => {
      expect(maskApiKey("abc")).toBe("••••••");
    });

    it("reveals only first 4 and last 2 characters", () => {
      const masked = maskApiKey("supersecretplatformkey123");
      expect(masked.startsWith("supe")).toBe(true);
      expect(masked.endsWith("23")).toBe(true);
      expect(masked).not.toContain("secretplatformkey");
    });

    it("never returns the raw key", () => {
      const key = "abcdefghijklmnopqrstuvwxyz123456";
      expect(maskApiKey(key)).not.toBe(key);
    });
  });

  describe("getRajaOngkirIntegrationState", () => {
    it("returns a masked key, never plaintext", async () => {
      mockFindUnique.mockResolvedValueOnce({
        provider: "RAJAONGKIR",
        encryptedApiKey: "enc:realplatformkey",
        isActive: true,
        lastTestedAt: null,
        connectionStatus: "OK",
        lastConnectionError: null,
      });
      const state = await getRajaOngkirIntegrationState();
      expect(state.isConfigured).toBe(true);
      expect(state.isActive).toBe(true);
      expect(state.maskedKey).toBe(maskApiKey("realplatformkey"));
      expect(state.maskedKey).not.toContain("realplatformkey");
    });

    it("reports not configured when no key present", async () => {
      mockFindUnique.mockResolvedValueOnce(null);
      const state = await getRajaOngkirIntegrationState();
      expect(state.isConfigured).toBe(false);
      expect(state.maskedKey).toBeUndefined();
    });
  });

  describe("getRajaOngkirClientConfig", () => {
    it("throws INTEGRATION_DISABLED when inactive", async () => {
      mockFindUnique.mockResolvedValueOnce({
        provider: "RAJAONGKIR",
        encryptedApiKey: "enc:key",
        isActive: false,
      });
      await expect(getRajaOngkirClientConfig()).rejects.toMatchObject({
        code: "INTEGRATION_DISABLED",
      });
    });

    it("throws MISSING_CREDENTIAL when key decrypts empty", async () => {
      mockFindUnique.mockResolvedValueOnce({
        provider: "RAJAONGKIR",
        encryptedApiKey: "enc:",
        isActive: true,
      });
      await expect(getRajaOngkirClientConfig()).rejects.toMatchObject({
        code: "MISSING_CREDENTIAL",
      });
    });

    it("resolves a decrypted apiKey only server-side", async () => {
      mockFindUnique.mockResolvedValueOnce({
        provider: "RAJAONGKIR",
        encryptedApiKey: "enc:plainvalue",
        isActive: true,
        baseUrl: "https://rajaongkir.komerce.id/api/v1/",
      });
      const config = await getRajaOngkirClientConfig();
      expect(config.apiKey).toBe("plainvalue");
    });
  });

  describe("upsertRajaOngkirApiKey", () => {
    it("encrypts the key before persisting", async () => {
      mockUpsert.mockResolvedValueOnce({});
      await upsertRajaOngkirApiKey("rawkey");
      const call = mockUpsert.mock.calls[0][0];
      expect(call.create.encryptedApiKey).toBe("enc:rawkey");
      expect(call.update.encryptedApiKey).toBe("enc:rawkey");
      expect(call.create.encryptedApiKey).not.toBe("rawkey");
    });
  });

  describe("recordRajaOngkirConnectionResult", () => {
    it("sanitizes long key-like tokens in errors", async () => {
      mockUpsert.mockResolvedValueOnce({});
      await recordRajaOngkirConnectionResult(
        "FAILED",
        "auth failed for token abcdefghijklmnopqrstuvwxyz012345",
      );
      const call = mockUpsert.mock.calls[0][0];
      expect(call.update.lastConnectionError).not.toContain("abcdefghijklmnopqrstuvwxyz012345");
      expect(call.update.lastConnectionError).toContain("***");
    });
  });
});
