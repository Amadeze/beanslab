import { describe, expect, it } from "vitest";
import { QUICK_ACTIONS } from "./mobileQuickActions";

describe("mobile quick actions", () => {
  it("has exactly five entries (the T10 acceptance budget)", () => {
    expect(QUICK_ACTIONS).toHaveLength(5);
  });

  it("each action has a non-empty label, href, and hint", () => {
    for (const action of QUICK_ACTIONS) {
      expect(action.label.length).toBeGreaterThan(0);
      expect(action.hint.length).toBeGreaterThan(0);
      expect(action.href.startsWith("/") || action.href.endsWith(".exe")).toBe(true);
    }
  });

  it("actions are unique by href", () => {
    const hrefs = QUICK_ACTIONS.map((action) => action.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});