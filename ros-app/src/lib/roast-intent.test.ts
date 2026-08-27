import { describe, expect, it } from "vitest";
import { analyzeRoastOutcome } from "./roast-intent";

describe("analyzeRoastOutcome", () => {
  it("derives yield and roast loss from measured weights", () => {
    expect(analyzeRoastOutcome(10, 8.5)).toMatchObject({
      lossKg: 1.5,
      lossPercent: 15,
      yieldPercent: 85,
      status: "NORMAL",
    });
  });

  it("uses a broad fallback while a profile is still learning", () => {
    expect(analyzeRoastOutcome(10, 9.3, [12, 13])).toMatchObject({
      expectedLossPercent: 15,
      expectedMinPercent: 8,
      expectedMaxPercent: 25,
      historySampleCount: 2,
    });
    expect(analyzeRoastOutcome(10, 7.4).status).toBe("REVIEW");
  });

  it("learns a tolerance from the ten most recent comparable roasts", () => {
    const result = analyzeRoastOutcome(10, 8, [14, 15, 16, 40]);
    expect(result.expectedLossPercent).toBe(15.5);
    expect(result.status).toBe("REVIEW");

    const stable = analyzeRoastOutcome(10, 8, [14, 15, 16]);
    expect(stable.expectedLossPercent).toBe(15);
    expect(stable.expectedMinPercent).toBe(12.03);
    expect(stable.expectedMaxPercent).toBe(17.97);
    expect(stable.status).toBe("REVIEW");
  });

  it("rejects physically impossible measurements", () => {
    expect(() => analyzeRoastOutcome(0, 1)).toThrow("Green Bean");
    expect(() => analyzeRoastOutcome(10, 0)).toThrow("Roasted Bean");
    expect(() => analyzeRoastOutcome(10, 10)).toThrow("lebih kecil");
  });
});
