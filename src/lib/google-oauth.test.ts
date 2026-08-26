import { describe, expect, it } from "vitest";
import {
  googleLoginDestination,
  parseVerifiedGoogleUser,
  resolveGoogleSignInTarget,
} from "./google-oauth";

describe("parseVerifiedGoogleUser", () => {
  it("normalizes a verified Google identity", () => {
    expect(parseVerifiedGoogleUser({
      sub: " google-sub ",
      name: " Rahmat Aryanto ",
      email: " Rahmat.Aryanto26@GMAIL.COM ",
      email_verified: true,
    })).toEqual({
      sub: "google-sub",
      name: "Rahmat Aryanto",
      email: "rahmat.aryanto26@gmail.com",
    });
  });

  it("rejects an unverified Google email", () => {
    expect(parseVerifiedGoogleUser({
      sub: "google-sub",
      name: "Rahmat Aryanto",
      email: "rahmat.aryanto26@gmail.com",
      email_verified: false,
    })).toBeNull();
  });
});

describe("googleLoginDestination", () => {
  it("keeps the requested tenant dashboard path", () => {
    expect(googleLoginDestination("/dashboard")).toBe("/dashboard");
  });

  it("keeps a safe tenant return path", () => {
    expect(googleLoginDestination("/penjualan")).toBe("/penjualan");
  });

  it("rejects a protocol-relative return path", () => {
    expect(googleLoginDestination("//evil.example")).toBe("/dashboard");
  });
});

// ── Account linking security (regression: silent account takeover) ──────────

describe("resolveGoogleSignInTarget", () => {
  const googleAccount = { id: "u1", googleId: "sub-1", password: null };
  const passwordAccount = { id: "u2", googleId: null, password: "bcrypt-hash" };
  const passwordlessAccount = { id: "u3", googleId: null, password: null };

  it("logs in when the Google id already belongs to the account", () => {
    expect(resolveGoogleSignInTarget(googleAccount, null)).toEqual({
      action: "login",
      user: googleAccount,
    });
    expect(resolveGoogleSignInTarget(googleAccount, googleAccount)).toEqual({
      action: "login",
      user: googleAccount,
    });
  });

  it("never links a Google identity to a password-protected account sharing the email", () => {
    // Regression: `userByGoogleId ?? userByEmail` allowed any Google visitor
    // claiming a victim's email to sign in to the victim's workspace.
    expect(resolveGoogleSignInTarget(null, passwordAccount)).toEqual({
      action: "reject",
      error: "EmailRegisteredUsePassword",
    });
  });

  it("links a passwordless account that owns the email", () => {
    expect(resolveGoogleSignInTarget(null, passwordlessAccount)).toEqual({
      action: "link",
      user: passwordlessAccount,
    });
  });

  it("routes unknown identities to signup", () => {
    expect(resolveGoogleSignInTarget(null, null)).toEqual({ action: "signup" });
  });

  it("rejects when Google id and email point at two different accounts", () => {
    expect(resolveGoogleSignInTarget(googleAccount, passwordAccount)).toEqual({
      action: "reject",
      error: "GoogleAccountConflict",
    });
  });
});
