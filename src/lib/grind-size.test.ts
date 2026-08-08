import { describe, expect, it } from "vitest";
import { GRIND_SIZE_LABELS } from "@/lib/grind-size";

describe("GRIND_SIZE_LABELS", () => {
  it("has labels for all enum values", () => {
    const expected = ["WHOLE_BEAN", "COARSE", "MEDIUM_COARSE", "MEDIUM", "MEDIUM_FINE", "FINE", "ESPRESSO", "CUSTOM"];
    for (const key of expected) {
      expect(GRIND_SIZE_LABELS[key]).toBeTruthy();
    }
  });

  it("has non-empty labels", () => {
    for (const label of Object.values(GRIND_SIZE_LABELS)) {
      expect(label.length).toBeGreaterThan(0);
    }
  });
});
