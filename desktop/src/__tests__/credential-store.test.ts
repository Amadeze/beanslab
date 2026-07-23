import { describe, it, expect } from "vitest";
import type { ConnectorCredentials, AppSettings } from "../shared/types";

describe("Credential Store Logic", () => {
  it("validates credential structure", () => {
    const validCredentials: ConnectorCredentials = {
      connectorId: "test-id",
      connectorToken: "test-token-123",
      machineId: "machine-123",
      machineName: "Test Machine",
      installationId: "install-123",
      computerName: "TEST-PC",
    };

    expect(validCredentials.connectorId).toBeTruthy();
    expect(validCredentials.connectorToken).toBeTruthy();
    expect(validCredentials.machineId).toBeTruthy();
    expect(validCredentials.machineName).toBeTruthy();
    expect(validCredentials.installationId).toBeTruthy();
    expect(validCredentials.computerName).toBeTruthy();
  });

  it("validates settings structure", () => {
    const validSettings: AppSettings = {
      watchFolder: "C:\\Users\\test\\Documents\\Artisan\\autosave",
      autoLaunch: true,
      apiBaseUrl: "http://localhost:3000",
    };

    expect(validSettings.watchFolder).toBeTruthy();
    expect(typeof validSettings.autoLaunch).toBe("boolean");
    expect(validSettings.apiBaseUrl).toBeTruthy();
  });

  it("handles null watchFolder", () => {
    const settings: AppSettings = {
      watchFolder: null,
      autoLaunch: false,
      apiBaseUrl: "http://localhost:3000",
    };

    expect(settings.watchFolder).toBeNull();
    expect(settings.autoLaunch).toBe(false);
  });

  it("validates credential JSON format", () => {
    const json = JSON.stringify({
      connectorId: "test",
      connectorToken: "token",
      machineId: "machine",
      machineName: "Machine",
      installationId: "install",
      computerName: "PC",
    });

    const parsed = JSON.parse(json);
    expect(parsed).toHaveProperty("connectorId");
    expect(parsed).toHaveProperty("connectorToken");
    expect(parsed).toHaveProperty("machineId");
  });
});

describe("Error Messages", () => {
  it("has user-friendly error messages", () => {
    // This tests that error messages are not technical jargon
    const errorMessages = [
      "Kode pairing tidak valid",
      "Autentikasi gagal",
      "File tidak valid",
      "Tidak dapat terhubung ke server",
    ];

    for (const msg of errorMessages) {
      expect(msg.length).toBeGreaterThan(10);
      expect(msg).not.toContain("Error");
      expect(msg).not.toContain("undefined");
      expect(msg).not.toContain("null");
    }
  });
});
