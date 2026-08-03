// =============================================================================
// EASING VALIDATOR TESTS — explicit grammar for CSS easing values
// =============================================================================

import { describe, it, expect } from "vitest";
import { validateEasing, isValidEasing } from "../easing";

describe("validateEasing — keywords", () => {
  for (const keyword of ["linear", "ease", "ease-in", "ease-out", "ease-in-out"]) {
    it(`accepts keyword ${keyword}`, () => {
      expect(validateEasing(keyword)).toBeNull();
    });
  }

  it("rejects unknown keywords", () => {
    expect(validateEasing("ease-in-out-cubic")).not.toBeNull();
    expect(validateEasing("cubic")).not.toBeNull();
  });
});

describe("validateEasing — cubic-bezier", () => {
  const valid = [
    "cubic-bezier(0.22, 1, 0.36, 1)",
    "cubic-bezier(0, 0, 0.2, 1)",
    "cubic-bezier(0.77, 0, 0.175, 1)",
    "cubic-bezier(0.34, 1.56, 0.64, 1)",
    "cubic-bezier(0.16, 1, 0.3, 1)",
    "cubic-bezier(1, 1, 0, 0)",
    "cubic-bezier(.22, 1, .36, 1)",
    "cubic-bezier(0.22, -0.5, 0.36, 1.5)",
  ];

  for (const value of valid) {
    it(`accepts ${value}`, () => {
      expect(validateEasing(value)).toBeNull();
    });
  }

  const invalid = [
    ["cubic-bezier(1.5, 1, 0.36, 1)", "x1 > 1"],
    ["cubic-bezier(-0.5, 1, 0.36, 1)", "x1 < 0"],
    ["cubic-bezier(0.22, 1, 2, 1)", "x2 > 1"],
    ["cubic-bezier(0.22, 1, 0.36)", "only 3 numbers"],
    ["cubic-bezier(0.22, 1, 0.36, 1, 0.5)", "5 numbers"],
    ["cubic-bezier(0.22, 1, 0.36, 1) extra", "trailing tokens"],
    ["cubic-bezier(0.22 1 0.36 1)", "no commas"],
    ["cubic-bezier(NaN, 1, 0.36, 1)", "NaN"],
    ["cubic-bezier(Infinity, 1, 0.36, 1)", "Infinity"],
    ["cubic-bezier(-Infinity, 1, 0.36, 1)", "-Infinity"],
    ["cubic-bezier(0.22e5, 1, 0.36, 1)", "scientific notation"],
    ["cubic-bezier(0.22, 1e5, 0.36, 1)", "scientific notation y"],
    ["cubic-bezier(0.22, ?, 0.36, 1)", "question mark"],
    ["cubic-bezier(0.22, 1, 0.36, 1", "missing closing paren"],
    ["cubic-bezier()", "empty"],
    ["cubic-bezier(0.22, (1), 0.36, 1)", "nested parens"],
  ];

  for (const [value, label] of invalid) {
    it(`rejects ${value} (${label})`, () => {
      expect(validateEasing(value)).not.toBeNull();
    });
  }
});

describe("validateEasing — steps", () => {
  const valid = [
    "steps(4)",
    "steps(4, start)",
    "steps(4,end)",
    "steps(1, end)",
    "steps(10000, end)",
  ];

  for (const value of valid) {
    it(`accepts ${value}`, () => {
      expect(validateEasing(value)).toBeNull();
    });
  }

  const invalid = [
    ["steps(0)", "zero"],
    ["steps(-1)", "negative"],
    ["steps(10001)", "too many"],
    ["steps(4.5)", "fractional"],
    ["steps(4, middle)", "bad position"],
    ["steps(four)", "not a number"],
    ["steps(4, end) extra", "trailing tokens"],
    ["steps()", "empty"],
    ["steps(4,", "malformed"],
  ];

  for (const [value, label] of invalid) {
    it(`rejects ${value} (${label})`, () => {
      expect(validateEasing(value)).not.toBeNull();
    });
  }
});

describe("validateEasing — general rejects", () => {
  const invalid = [
    "",
    "   ",
    "1e5",
    "cubic-bezier(0.22, 1, 0.36, 1) !important",
    "var(--ease)",
    "undefined",
    "null",
  ];

  for (const value of invalid) {
    it(`rejects ${JSON.stringify(value)}`, () => {
      expect(validateEasing(value)).not.toBeNull();
    });
  }

  it("trims surrounding whitespace", () => {
    expect(validateEasing("  linear  ")).toBeNull();
    expect(validateEasing("  cubic-bezier(0.22, 1, 0.36, 1)  ")).toBeNull();
  });

  it("isValidEasing mirrors validateEasing", () => {
    expect(isValidEasing("linear")).toBe(true);
    expect(isValidEasing("cubic-bezier(1.5, 1, 0.36, 1)")).toBe(false);
    expect(isValidEasing("1e5")).toBe(false);
  });
});
