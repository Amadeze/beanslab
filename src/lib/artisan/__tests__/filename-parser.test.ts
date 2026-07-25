import { describe, expect, it } from "vitest";
import { parseAlogFilename } from "../filename-parser";

describe("parseAlogFilename", () => {
  it("parses filename with date", () => {
    const result = parseAlogFilename("Arabica-Gayo-Dark-2026-07-23.alog");
    expect(result.name).toBe("Arabica Gayo Dark");
    expect(result.date).toBe("2026-07-23");
  });

  it("parses another filename with date", () => {
    const result = parseAlogFilename("Robusta-Lampung-MediumDark-2026-07-23.alog");
    expect(result.name).toBe("Robusta Lampung Mediumdark");
    expect(result.date).toBe("2026-07-23");
  });

  it("parses filename without date", () => {
    const result = parseAlogFilename("sweet-marias-ethiopia-dry-process.alog");
    expect(result.name).toBe("Sweet Marias Ethiopia Dry Process");
    expect(result.date).toBeNull();
  });

  it("handles uppercase extension", () => {
    const result = parseAlogFilename("Gayo-Heavy-2026-07-22.ALOG");
    expect(result.name).toBe("Gayo Heavy");
    expect(result.date).toBe("2026-07-22");
  });

  it("handles single word name", () => {
    const result = parseAlogFilename("Gayo.alog");
    expect(result.name).toBe("Gayo");
    expect(result.date).toBeNull();
  });
});
