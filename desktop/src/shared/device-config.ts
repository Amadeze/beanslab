import type { AppSettings, DeviceBridgeAdapter, DeviceBridgeConfig } from "./types";

const ADAPTERS = new Set<DeviceBridgeAdapter>([
  "AUTO",
  "ARTISAN_TC4",
  "AILLIO_R1",
  "AILLIO_R2",
  "HOTTOP",
  "SANTOKER",
  "SANTOKER_R",
  "KALEIDO",
  "MODBUS_RTU",
  "MODBUS_TCP",
  "PHIDGET",
  "GENERIC_LINE",
]);

const TRANSPORTS = new Set(["SERIAL", "USB", "NETWORK", "BLE"] as const);

function finiteNumber(value: unknown, minimum: number, maximum: number): number | undefined {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : undefined;
}

function optionalInteger(value: unknown, minimum: number, maximum: number): number | undefined {
  const number = finiteNumber(value, minimum, maximum);
  return number == null ? undefined : Math.trunc(number);
}

export function sanitizeDeviceBridgeConfig(value: unknown): DeviceBridgeConfig | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const port = typeof source.port === "string" ? source.port.trim() : "";
  if (!port) return null;

  const adapter = ADAPTERS.has(source.adapter as DeviceBridgeAdapter)
    ? source.adapter as DeviceBridgeAdapter
    : "AUTO";
  const transport = TRANSPORTS.has(source.transport as "SERIAL" | "USB" | "NETWORK" | "BLE")
    ? source.transport as "SERIAL" | "USB" | "NETWORK" | "BLE"
    : undefined;
  const host = typeof source.host === "string" && source.host.trim()
    ? source.host.trim()
    : undefined;

  return {
    port,
    adapter,
    baudRate: optionalInteger(source.baudRate, 300, 3_000_000) ?? 115200,
    intervalMs: optionalInteger(source.intervalMs, 100, 10_000) ?? 1000,
    ...(transport ? { transport } : {}),
    ...(host ? { host } : {}),
    ...(optionalInteger(source.networkPort, 1, 65_535) != null
      ? { networkPort: optionalInteger(source.networkPort, 1, 65_535) }
      : {}),
    ...(optionalInteger(source.unitId, 0, 247) != null
      ? { unitId: optionalInteger(source.unitId, 0, 247) }
      : {}),
    ...(optionalInteger(source.btRegister, 0, 65_535) != null
      ? { btRegister: optionalInteger(source.btRegister, 0, 65_535) }
      : {}),
    ...(optionalInteger(source.etRegister, 0, 65_535) != null
      ? { etRegister: optionalInteger(source.etRegister, 0, 65_535) }
      : {}),
    ...(source.functionCode === 3 || source.functionCode === 4
      ? { functionCode: source.functionCode }
      : {}),
    ...(finiteNumber(source.scale, -100_000, 100_000) != null
      ? { scale: finiteNumber(source.scale, -100_000, 100_000) }
      : {}),
    ...(finiteNumber(source.offset, -100_000, 100_000) != null
      ? { offset: finiteNumber(source.offset, -100_000, 100_000) }
      : {}),
    ...(optionalInteger(source.btChannel, 0, 255) != null
      ? { btChannel: optionalInteger(source.btChannel, 0, 255) }
      : {}),
    ...(optionalInteger(source.etChannel, 0, 255) != null
      ? { etChannel: optionalInteger(source.etChannel, 0, 255) }
      : {}),
    ...(optionalInteger(source.serialNumber, 0, Number.MAX_SAFE_INTEGER) != null
      ? { serialNumber: optionalInteger(source.serialNumber, 0, Number.MAX_SAFE_INTEGER) }
      : {}),
    ...(typeof source.swapBtEt === "boolean" ? { swapBtEt: source.swapBtEt } : {}),
    ...(finiteNumber(source.btOffset, -100, 100) != null
      ? { btOffset: finiteNumber(source.btOffset, -100, 100) }
      : {}),
    ...(finiteNumber(source.etOffset, -100, 100) != null
      ? { etOffset: finiteNumber(source.etOffset, -100, 100) }
      : {}),
    ...(finiteNumber(source.btScale, 0.01, 100) != null
      ? { btScale: finiteNumber(source.btScale, 0.01, 100) }
      : {}),
    ...(finiteNumber(source.etScale, 0.01, 100) != null
      ? { etScale: finiteNumber(source.etScale, 0.01, 100) }
      : {}),
  };
}

export function deviceConfigFromSettings(
  settings: Partial<AppSettings> & Record<string, unknown>,
): DeviceBridgeConfig | null {
  const current = sanitizeDeviceBridgeConfig(settings.deviceConfig);
  if (current) return current;
  if (typeof settings.selectedSerialPort !== "string" || !settings.selectedSerialPort.trim()) {
    return null;
  }
  return sanitizeDeviceBridgeConfig({
    port: settings.selectedSerialPort,
    adapter: settings.serialAdapter,
    baudRate: settings.serialBaudRate,
    intervalMs: 1000,
    transport: "SERIAL",
  });
}
