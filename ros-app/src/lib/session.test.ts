import { describe, expect, it } from "vitest";
import { SESSION_OPTIONS } from "./session";

describe("session cookie configuration", () => {
  it("allows the session on the top-level redirect after OAuth", () => {
    expect(SESSION_OPTIONS.cookieOptions).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 8,
    });
  });
});
