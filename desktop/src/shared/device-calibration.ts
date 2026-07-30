import type { DeviceBridgeConfig, DeviceBridgeSample } from "./types";

function calibrated(value: number | null, scale: number | undefined, offset: number | undefined): number | null {
  if (value == null) return null;
  return Math.round((value * (scale ?? 1) + (offset ?? 0)) * 100) / 100;
}

/**
 * Applies user calibration only to BT/ET. Machine telemetry remains untouched and read-only.
 */
export function calibrateDeviceSample(
  sample: DeviceBridgeSample,
  config: DeviceBridgeConfig | null,
): DeviceBridgeSample {
  if (!config) return { ...sample };
  const rawBt = config.swapBtEt ? sample.et : sample.bt;
  const rawEt = config.swapBtEt ? sample.bt : sample.et;
  return {
    ...sample,
    bt: calibrated(rawBt, config.btScale, config.btOffset),
    et: calibrated(rawEt, config.etScale, config.etOffset),
  };
}
