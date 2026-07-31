import { describe, expect, it } from "vitest";
import { googleLoginDestination, parseVerifiedGoogleUser } from "./google-oauth";

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
