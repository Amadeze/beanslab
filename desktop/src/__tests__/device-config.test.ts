import { describe, expect, it } from "vitest";
import { deviceConfigFromSettings, sanitizeDeviceBridgeConfig } from "../shared/device-config";

describe("device config persistence", () => {
  it("keeps the complete advanced machine configuration", () => {
    expect(sanitizeDeviceBridgeConfig({
      port: "192.168.1.20:502",
      adapter: "MODBUS_TCP",
      baudRate: 115200,
      intervalMs: 750,
      transport: "NETWORK",
      host: "192.168.1.20",
      networkPort: 502,
      unitId: 2,
      btRegister: 10,
      etRegister: 11,
      functionCode: 4,
      scale: 0.1,
      offset: -2.5,
      swapBtEt: true,
      btOffset: -1.5,
      etOffset: 2,
      btScale: 1.01,
      etScale: 0.99,
    })).toEqual({
      port: "192.168.1.20:502",
      adapter: "MODBUS_TCP",
      baudRate: 115200,
      intervalMs: 750,
      transport: "NETWORK",
      host: "192.168.1.20",
      networkPort: 502,
      unitId: 2,
      btRegister: 10,
      etRegister: 11,
      functionCode: 4,
      scale: 0.1,
      offset: -2.5,
      swapBtEt: true,
      btOffset: -1.5,
      etOffset: 2,
      btScale: 1.01,
      etScale: 0.99,
    });
  });

  it("migrates the legacy serial settings once", () => {
    expect(deviceConfigFromSettings({
      selectedSerialPort: "COM4",
      serialAdapter: "ARTISAN_TC4",
      serialBaudRate: 115200,
    })).toEqual(expect.objectContaining({
      port: "COM4",
      adapter: "ARTISAN_TC4",
      transport: "SERIAL",
    }));
  });

  it("rejects empty endpoints and unsafe numeric ranges", () => {
    expect(sanitizeDeviceBridgeConfig({ port: "", adapter: "AUTO", baudRate: 115200 })).toBeNull();
    expect(sanitizeDeviceBridgeConfig({
      port: "COM8",
      adapter: "MODBUS_RTU",
      baudRate: -1,
      unitId: 999,
    })).toEqual(expect.objectContaining({
      port: "COM8",
      baudRate: 115200,
    }));
  });
});
