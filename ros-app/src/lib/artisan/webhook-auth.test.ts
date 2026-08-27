import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { findTenantByArtisanWebhookToken } from "./webhook-auth";
import { hashWebhookToken } from "./connector-auth";

const PEPPER = "test-pepper";
const TOKEN = "artisan-token-secret-123";
const EXPECTED_HASH = crypto
  .createHash("sha256")
  .update(`${PEPPER}:webhook:${TOKEN}`)
  .digest("hex");

function fixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "tenant-1",
    isActive: true,
    isArtisanEnabled: true,
    subscriptionTier: "PRO",
    subscriptionStatus: "ACTIVE",
    trialEndsAt: null,
    nextBillingDate: null,
    artisanWebhookToken: null,
    artisanWebhookTokenHash: null,
    ...overrides,
  };
}

function mockClient(options: {
  hashRow?: Record<string, unknown> | null;
  legacyRow?: Record<string, unknown> | null;
}) {
  const findUnique = vi.fn(async ({ where }: { where: { artisanWebhookTokenHash: string } }) => {
    if (options.hashRow && where.artisanWebhookTokenHash === options.hashRow.artisanWebhookTokenHash) {
      return options.hashRow;
    }
    return null;
  });
  const findFirst = vi.fn(async () => options.legacyRow ?? null);
  const update = vi.fn(async () => ({}));
  return { client: { tenant: { findUnique, findFirst, update } }, findUnique, findFirst, update };
}

beforeEach(() => {
  process.env.ARTISAN_CONNECTOR_TOKEN_PEPPER = PEPPER;
});

afterEach(() => {
  delete process.env.ARTISAN_CONNECTOR_TOKEN_PEPPER;
});

describe("findTenantByArtisanWebhookToken", () => {
  it("matches a tenant by the hashed token and re-verifies with a timing-safe compare", async () => {
    const { client, findUnique, findFirst, update } = mockClient({
      hashRow: fixture({ id: "tenant-hashed", artisanWebhookTokenHash: EXPECTED_HASH }),
    });

    const tenant = await findTenantByArtisanWebhookToken(client, TOKEN);

    expect(tenant?.id).toBe("tenant-hashed");
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { artisanWebhookTokenHash: EXPECTED_HASH } }),
    );
    expect(findFirst).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects a stored hash that does not match the presented token", async () => {
    const { client, update } = mockClient({
      hashRow: fixture({ id: "tenant-other", artisanWebhookTokenHash: "f0".repeat(32) }),
    });

    const tenant = await findTenantByArtisanWebhookToken(client, TOKEN);

    expect(tenant).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it("falls back to the legacy plaintext token with a timing-safe check and lazily migrates it", async () => {
    const { client, findFirst, update } = mockClient({
      legacyRow: fixture({ id: "tenant-legacy", artisanWebhookToken: TOKEN }),
    });

    const tenant = await findTenantByArtisanWebhookToken(client, TOKEN);

    expect(tenant?.id).toBe("tenant-legacy");
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { artisanWebhookToken: TOKEN } }),
    );
    expect(update).toHaveBeenCalledWith({
      where: { id: "tenant-legacy" },
      data: { artisanWebhookTokenHash: EXPECTED_HASH },
      select: { id: true },
    });
  });

  it("does not migrate when the legacy token does not match", async () => {
    const { client, update } = mockClient({
      legacyRow: fixture({ id: "tenant-other", artisanWebhookToken: "another-token" }),
    });

    const tenant = await findTenantByArtisanWebhookToken(client, TOKEN);

    expect(tenant).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it("returns null when no tenant matches", async () => {
    const { client, update } = mockClient({});

    const tenant = await findTenantByArtisanWebhookToken(client, TOKEN);

    expect(tenant).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });
});