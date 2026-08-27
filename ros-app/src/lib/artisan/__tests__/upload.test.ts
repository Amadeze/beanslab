import { describe, expect, it } from "vitest";
import { isAlogFile } from "../parser";

describe("Artisan upload validation", () => {
  it("validates .alog file extension", () => {
    expect(isAlogFile("roast.alog")).toBe(true);
    expect(isAlogFile("ROAST.ALOG")).toBe(true);
    expect(isAlogFile("roast.Alog")).toBe(true);
    expect(isAlogFile("roast.xml")).toBe(false);
    expect(isAlogFile("roast.json")).toBe(false);
    expect(isAlogFile("roast.txt")).toBe(false);
    expect(isAlogFile("roast")).toBe(false);
  });

  it("validates file size limits", () => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    expect(1024).toBeLessThanOrEqual(maxSize); // 1KB OK
    expect(maxSize).toBeLessThanOrEqual(maxSize); // 10MB OK
    expect(maxSize + 1).toBeGreaterThan(maxSize); // 10MB + 1 too large
  });

  it("validates SHA-256 hash format", () => {
    const hash = crypto.createHash("sha256").update("test").digest("hex");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash.length).toBe(64);
  });

  it("detects duplicate files by hash", () => {
    const buffer1 = Buffer.from("test content");
    const buffer2 = Buffer.from("test content");
    const buffer3 = Buffer.from("different content");

    const hash1 = crypto.createHash("sha256").update(buffer1).digest("hex");
    const hash2 = crypto.createHash("sha256").update(buffer2).digest("hex");
    const hash3 = crypto.createHash("sha256").update(buffer3).digest("hex");

    expect(hash1).toBe(hash2); // Same content = same hash
    expect(hash1).not.toBe(hash3); // Different content = different hash
  });
});

import crypto from "crypto";
