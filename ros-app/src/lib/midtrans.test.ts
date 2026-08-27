import { afterEach, describe, expect, it, vi } from "vitest";
import { createMidtransSnapTransaction } from "./midtrans";

function stubGatewayError(status: number, body: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: false,
      status,
      text: async () => body,
    })) as unknown as typeof fetch,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("createMidtransSnapTransaction error handling", () => {
  it("throws only a sanitized status and never forwards the raw gateway body", async () => {
    const rawBody = '{"status_code":"402","status_message":"Payment requires authorization","id":"txn-ref-123"}';
    stubGatewayError(402, rawBody);

    let thrown: unknown = null;
    try {
      await createMidtransSnapTransaction("server-key", false, {
        order_id: "INV-TEST-001",
        gross_amount: 100000,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe("Midtrans API failed with status 402");
    expect(String(thrown)).not.toContain("Payment requires authorization");
    expect(String(thrown)).not.toContain("txn-ref-123");
  });

  it("does not log the raw gateway response", async () => {
    const rawBody = '{"status_message":"denied"}';
    stubGatewayError(403, rawBody);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await createMidtransSnapTransaction("server-key", false, {
      order_id: "INV-TEST-002",
      gross_amount: 50000,
    }).catch(() => undefined);

    expect(errorSpy).not.toHaveBeenCalled();
  });
});