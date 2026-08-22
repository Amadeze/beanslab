import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { hasValidImageSignature, uploadPrivateObject } from "./storage";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe("image signature validation", () => {
  it("accepts matching JPEG, PNG, and WebP signatures", () => {
    expect(
      hasValidImageSignature(Buffer.from([0xff, 0xd8, 0xff, 0x00]), "image/jpeg"),
    ).toBe(true);
    expect(
      hasValidImageSignature(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        "image/png",
      ),
    ).toBe(true);
    expect(
      hasValidImageSignature(
        Buffer.from("RIFF0000WEBP", "ascii"),
        "image/webp",
      ),
    ).toBe(true);
  });

  it("rejects MIME spoofing", () => {
    expect(
      hasValidImageSignature(Buffer.from("<svg></svg>"), "image/png"),
    ).toBe(false);
  });
});

describe("private object storage", () => {
  it("uploads an Artisan log to the private bucket with a safe object key", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    process.env.SUPABASE_PRIVATE_STORAGE_BUCKET = "private-artifacts";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 200 }),
    );

    const objectPath = await uploadPrivateObject({
      tenantId: "tenant/unsafe",
      namespace: "artisan/machine one",
      buffer: Buffer.from("{'recording_version':'2.10.4'}"),
      mimeType: "application/octet-stream",
      extension: ".alog",
    });

    expect(objectPath).toMatch(
      /^tenant-unsafe\/artisan\/machine-one\/\d+-[a-f0-9-]+\.alog$/,
    );
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      `/storage/v1/object/private-artifacts/${objectPath}`,
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({
        "Content-Type": "application/octet-stream",
      }),
    });
  });

  it("rejects unsafe file extensions", async () => {
    await expect(
      uploadPrivateObject({
        tenantId: "tenant",
        namespace: "artisan/machine",
        buffer: Buffer.from("test"),
        mimeType: "application/octet-stream",
        extension: "../exe",
      }),
    ).rejects.toThrow("Invalid private object extension");
  });

  it("uses the explicit E2E local root even when Supabase variables exist", async () => {
    const localRoot = await mkdtemp(join(tmpdir(), "ros-storage-e2e-"));
    process.env.ROASTD_E2E_LOCAL_STORAGE_ROOT = localRoot;
    process.env.SUPABASE_URL = "https://placeholder.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "placeholder-service-role";
    const fetchMock = vi.spyOn(globalThis, "fetch");

    try {
      const contents = Buffer.from("private-e2e-object");
      const objectPath = await uploadPrivateObject({
        tenantId: "tenant-e2e",
        namespace: "payment-proofs",
        buffer: contents,
        mimeType: "application/octet-stream",
        extension: "bin",
      });

      expect(fetchMock).not.toHaveBeenCalled();
      await expect(
        readFile(join(localRoot, "private-uploads", ...objectPath.split("/"))),
      ).resolves.toEqual(contents);
    } finally {
      await rm(localRoot, { recursive: true, force: true });
    }
  });
});
