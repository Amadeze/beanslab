import { describe, expect, it } from "vitest";
import { shouldHideWindowOnClose } from "../main/window-lifecycle";

describe("window lifecycle", () => {
  it("keeps the app in the tray for a normal window close", () => {
    expect(shouldHideWindowOnClose(false)).toBe(true);
  });

  it("allows the window to close during an actual app quit", () => {
    expect(shouldHideWindowOnClose(true)).toBe(false);
  });
});
