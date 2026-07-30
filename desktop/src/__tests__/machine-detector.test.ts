import { describe, expect, it } from "vitest";
import { classifyMachinePort } from "../main/machine-detector";

describe("classifyMachinePort", () => {
  it("prioritizes common USB adapters used by roasting hardware", () => {
    expect(classifyMachinePort({
      path: "COM7",
      manufacturer: "FTDI",
      vendorId: "0403",
      productId: "6001",
      serialNumber: "ROAST-1",
      pnpId: "USB\\VID_0403&PID_6001",
      locationId: undefined,
    }))?.toMatchObject({ path: "COM7", confidence: "LIKELY", manufacturer: "FTDI" });
  });

  it("keeps generic serial ports visible as a fallback", () => {
    expect(classifyMachinePort({ path: "COM1" }))?.toMatchObject({
      path: "COM1",
      confidence: "GENERIC",
    });
  });

  it("ignores bluetooth virtual serial ports", () => {
    expect(classifyMachinePort({ path: "COM9", pnpId: "BTHENUM\\DEV_123" })).toBeNull();
  });

  it("ignores printer emulation ports", () => {
    expect(classifyMachinePort({
      path: "COM2",
      manufacturer: "EPSON",
      friendlyName: "EPSON COM Emulation USB Port (COM2)",
    })).toBeNull();
  });
});
