import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  roleState,
  mockUpsert,
  mockGetConfig,
  mockRecord,
  mockSearch,
} = vi.hoisted(() => ({
  roleState: { role: "SUPERADMIN" as string },
  mockUpsert: vi.fn(async () => {}),
  mockGetConfig: vi.fn(async () => ({ apiKey: "k", baseUrl: "https://x/" })),
  mockRecord: vi.fn(async () => {}),
  mockSearch: vi.fn(async () => [{ providerId: "1", label: "Jakarta" }]),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(async (...roles: string[]) => {
    if (!roles.includes(roleState.role)) {
      throw new Error("FORBIDDEN");
    }
    return { id: "u1", tenantId: "t1", role: roleState.role };
  }),
}));

vi.mock("@/lib/shipping/platform-integration", () => ({
  upsertRajaOngkirApiKey: mockUpsert,
  getRajaOngkirClientConfig: mockGetConfig,
  recordRajaOngkirConnectionResult: mockRecord,
}));

vi.mock("@/lib/shipping/providers/rajaongkir", () => ({
  searchDomesticDestination: mockSearch,
}));

import {
  saveRajaOngkirApiKey,
  testRajaOngkirConnection,
} from "./actions";
import { ShippingProviderError } from "@/lib/shipping/errors";

function formDataWith(apiKey: string): FormData {
  const fd = new FormData();
  fd.set("apiKey", apiKey);
  return fd;
}

describe("superadmin RajaOngkir authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsert.mockReset();
    mockGetConfig.mockReset().mockResolvedValue({ apiKey: "k", baseUrl: "https://x/" });
    mockRecord.mockReset();
    mockSearch.mockReset().mockResolvedValue([{ providerId: "1", label: "Jakarta" }]);
    roleState.role = "SUPERADMIN";
  });

  it("SUPERADMIN can save the platform API key", async () => {
    const result = await saveRajaOngkirApiKey(formDataWith("a-valid-key-12345"));
    expect(result.success).toBe(true);
    expect(mockUpsert).toHaveBeenCalledOnce();
  });

  it("tenant OWNER cannot save the platform API key", async () => {
    roleState.role = "OWNER";
    await expect(saveRajaOngkirApiKey(formDataWith("a-valid-key-12345"))).rejects.toThrow(
      "FORBIDDEN",
    );
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("SUPERADMIN can run a connection test", async () => {
    const result = await testRajaOngkirConnection();
    expect(result.success).toBe(true);
    expect(mockRecord).toHaveBeenCalledWith("OK");
  });

  it("tenant OWNER cannot run a connection test", async () => {
    roleState.role = "OWNER";
    await expect(testRajaOngkirConnection()).rejects.toThrow("FORBIDDEN");
  });

  it("records FAILED when the provider rejects the credential", async () => {
    mockSearch.mockRejectedValueOnce(
      new ShippingProviderError("PROVIDER_UNAUTHORIZED", "unauthorized"),
    );
    const result = await testRajaOngkirConnection();
    expect(result.success).toBe(false);
    expect(result.status).toBe("FAILED");
    expect(mockRecord).toHaveBeenCalledWith("FAILED", expect.any(String));
  });
});
