import { describe, expect, it } from "vitest";

import { getQuickBatchLaunchReadiness } from "../shared/quick-batch";

describe("quick batch launch readiness", () => {
  it("offers one-click start only for a connected machine and matching web reference", () => {
    expect(getQuickBatchLaunchReadiness({
      bridgeStatus: "CONNECTED",
      selectedRoastLevel: "MEDIUM",
      suggestedRoastLevel: "MEDIUM",
      recommendedProfileId: "profile-1",
    })).toEqual({ canStartImmediately: true, reason: "READY" });
  });

  it("keeps the batch prepared while the machine is disconnected", () => {
    expect(getQuickBatchLaunchReadiness({
      bridgeStatus: "DISCONNECTED",
      selectedRoastLevel: "MEDIUM",
      suggestedRoastLevel: "MEDIUM",
      recommendedProfileId: "profile-1",
    })).toEqual({ canStartImmediately: false, reason: "DEVICE_NOT_READY" });
  });

  it("does not promise immediate start after the roast level changes", () => {
    expect(getQuickBatchLaunchReadiness({
      bridgeStatus: "CONNECTED",
      selectedRoastLevel: "DARK",
      suggestedRoastLevel: "MEDIUM",
      recommendedProfileId: "profile-1",
    })).toEqual({ canStartImmediately: false, reason: "REFERENCE_NOT_READY" });
  });
});
