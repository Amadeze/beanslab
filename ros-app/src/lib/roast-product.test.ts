import { describe, expect, it } from "vitest";
import { greenBeanIdentity, roastedBeanName } from "./roast-product";

describe("roast product identity", () => {
  it("preserves species and origin while removing inventory words", () => {
    expect(greenBeanIdentity("Robusta Malang GB")).toBe("Robusta Malang");
    expect(greenBeanIdentity("Green Bean Arabica Gayo")).toBe("Arabica Gayo");
  });

  it("creates one deterministic name per roast level", () => {
    expect(roastedBeanName("Robusta Malang GB", "DARK")).toBe("Robusta Malang · Dark");
    expect(roastedBeanName("Arabica Gayo - Green Bean", "MEDIUM_DARK")).toBe(
      "Arabica Gayo · Medium Dark",
    );
  });
});
