import { describe, expect, it } from "vitest";
import { calibrateDeviceSample } from "../shared/device-calibration";

const sample = {
  bt: 180,
  et: 200,
  at: 10,
  heater: 65,
  fan: 40,
};

describe("device sensor calibration", () => {
  it("swaps channels and applies an independent correction", () => {
    expect(calibrateDeviceSample(sample, {
      port: "COM4",
      adapter: "ARTISAN_TC4",
      baudRate: 115200,
      swapBtEt: true,
      btOffset: -1.5,
      etOffset: 2,
    })).toEqual({ ...sample, bt: 198.5, et: 182 });
  });

  it("does not alter actuator telemetry", () => {
    const result = calibrateDeviceSample(sample, {
      port: "COM4",
      adapter: "ARTISAN_TC4",
      baudRate: 115200,
      btScale: 1.01,
    });
    expect(result.heater).toBe(65);
    expect(result.fan).toBe(40);
  });
});
