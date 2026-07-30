import { execFile } from "child_process";
import { promisify } from "util";
import type { DetectedMachineDevice } from "../shared/types";

const execFileAsync = promisify(execFile);

const MACHINE_ADAPTER_HINTS = [
  "aillio",
  "arduino",
  "ch340",
  "cp210",
  "ftdi",
  "modbus",
  "phidget",
  "prolific",
  "roast",
  "silicon labs",
  "usb serial",
  "wch.cn",
];

const NON_MACHINE_HINTS = ["bthenum", "bluetooth", "epson", "fax", "printer"];

export interface MachinePortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  pnpId?: string;
  locationId?: string;
  productId?: string;
  vendorId?: string;
  friendlyName?: string;
}

const WINDOWS_SERIAL_QUERY = [
  "$ports = Get-CimInstance Win32_SerialPort -ErrorAction SilentlyContinue | ForEach-Object {",
  "  [PSCustomObject]@{",
  "    path = $_.DeviceID; manufacturer = $_.Manufacturer; pnpId = $_.PNPDeviceID; friendlyName = $_.Name",
  "  }",
  "}",
  "$ports | ConvertTo-Json -Compress",
].join("\n");

function clean(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function classifyMachinePort(port: MachinePortInfo): DetectedMachineDevice | null {
  const path = port.path.trim();
  if (!path) return null;

  const searchable = [port.manufacturer, port.pnpId, port.friendlyName, path]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Hide obvious virtual/peripheral ports so operators only see plausible inputs.
  if (NON_MACHINE_HINTS.some((hint) => searchable.includes(hint))) return null;

  const confidence = MACHINE_ADAPTER_HINTS.some((hint) => searchable.includes(hint))
    ? "LIKELY"
    : "GENERIC";
  const manufacturer = clean(port.manufacturer);
  const friendlyName = clean(port.friendlyName);

  return {
    path,
    name: friendlyName || manufacturer || `Perangkat serial ${path}`,
    manufacturer,
    vendorId: clean(port.vendorId),
    productId: clean(port.productId),
    serialNumber: clean(port.serialNumber),
    confidence,
  };
}

export async function detectMachineDevices(): Promise<DetectedMachineDevice[]> {
  if (process.platform !== "win32") return [];
  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", WINDOWS_SERIAL_QUERY],
      { windowsHide: true, timeout: 8_000, maxBuffer: 1024 * 1024 },
    );
    const trimmed = stdout.trim();
    if (!trimmed) return [];
    const parsed = JSON.parse(trimmed) as MachinePortInfo | MachinePortInfo[];
    const ports = Array.isArray(parsed) ? parsed : [parsed];
    return ports
      .map(classifyMachinePort)
      .filter((device): device is DetectedMachineDevice => device !== null)
      .sort((left, right) => {
        if (left.confidence !== right.confidence) return left.confidence === "LIKELY" ? -1 : 1;
        return left.path.localeCompare(right.path, undefined, { numeric: true });
      });
  } catch (error) {
    console.error("[Roastd Studio] Machine discovery failed", error);
    return [];
  }
}
