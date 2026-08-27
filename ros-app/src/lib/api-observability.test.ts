import { describe, expect, it } from "vitest";

import { getRequestId, internalErrorResponse } from "./api-observability";

describe("API observability", () => {
  it("keeps a safe incoming request ID", () => {
    const headers = new Headers({ "x-request-id": "checkout_123.trace-4" });

    expect(getRequestId(headers)).toBe("checkout_123.trace-4");
  });

  it("replaces an invalid incoming request ID", () => {
    const headers = new Headers({ "x-request-id": "contains spaces and unsafe data" });
    const requestId = getRequestId(headers);

    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("returns a generic internal error with a traceable reference", async () => {
    const response = internalErrorResponse("request-123");
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get("x-request-id")).toBe("request-123");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({
      error: "Terjadi kesalahan sistem. Silakan coba lagi.",
      requestId: "request-123",
    });
    expect(JSON.stringify(body)).not.toContain("database");
  });
});
