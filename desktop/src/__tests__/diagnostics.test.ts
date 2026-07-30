import { describe, expect, it } from "vitest";
import { sanitizeDiagnosticValue } from "../main/diagnostics";

describe("diagnostic redaction", () => {
  it("removes credentials recursively and from log strings", () => {
    const output = JSON.stringify(sanitizeDiagnosticValue({
      connectorToken: "super-secret",
      nested: { apiKey: "abc123", adapter: "MODBUS_RTU" },
      log: 'request {"serverKey":"midtrans-secret"} Bearer token.value',
    }));
    expect(output).not.toContain("super-secret");
    expect(output).not.toContain("abc123");
    expect(output).not.toContain("midtrans-secret");
    expect(output).not.toContain("token.value");
    expect(output).toContain("MODBUS_RTU");
  });
});
