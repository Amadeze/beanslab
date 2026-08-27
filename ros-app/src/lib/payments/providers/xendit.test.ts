import { describe, expect, it, vi } from "vitest";
import { createXenditPaymentRequest, XenditProviderError } from "./xendit";

describe("createXenditPaymentRequest", () => {
  it("sends tenant-scoped idempotent payment requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      payment_request_id: "pr-1",
      reference_id: "INV-1",
      status: "REQUIRES_ACTION",
      request_amount: 150000,
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    await createXenditPaymentRequest({
      referenceId: "INV-1",
      amount: 150000,
      channelCode: "QRIS",
      channelProperties: { expires_at: "2026-07-30T00:00:00Z" },
      subAccountId: "sub-account-1",
    }, { secretKey: "xnd_development_key", fetch: fetchMock });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, request] = fetchMock.mock.calls[0];
    expect(request.headers).toMatchObject({
      "api-version": "2024-11-11",
      "for-user-id": "sub-account-1",
      "idempotency-key": "INV-1",
    });
    expect(JSON.parse(request.body)).toMatchObject({ reference_id: "INV-1", request_amount: 150000 });
  });

  it("keeps provider error details for observability", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "invalid channel" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    }));
    await expect(createXenditPaymentRequest({
      referenceId: "INV-2",
      amount: 1000,
      channelCode: "BAD",
      channelProperties: {},
    }, { secretKey: "key", fetch: fetchMock })).rejects.toBeInstanceOf(XenditProviderError);
  });
});
