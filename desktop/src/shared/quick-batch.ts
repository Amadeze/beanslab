import type { DeviceBridgeStatus, StudioRoastLevel } from "./types";

export type QuickBatchLaunchReadiness = {
  canStartImmediately: boolean;
  reason: "READY" | "DEVICE_NOT_READY" | "REFERENCE_NOT_READY";
};

/** Only promise an immediate CHARGE when both prerequisites are predictable. */
export function getQuickBatchLaunchReadiness(input: {
  bridgeStatus: DeviceBridgeStatus;
  selectedRoastLevel: StudioRoastLevel;
  suggestedRoastLevel: StudioRoastLevel;
  recommendedProfileId: string | null;
}): QuickBatchLaunchReadiness {
  if (
    !input.recommendedProfileId ||
    input.selectedRoastLevel !== input.suggestedRoastLevel
  ) {
    return { canStartImmediately: false, reason: "REFERENCE_NOT_READY" };
  }
  if (input.bridgeStatus !== "CONNECTED") {
    return { canStartImmediately: false, reason: "DEVICE_NOT_READY" };
  }
  return { canStartImmediately: true, reason: "READY" };
}
