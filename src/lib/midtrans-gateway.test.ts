import { describe, expect, it, vi, beforeEach } from "vitest";

// Create mocks via vi.hoisted() so they are available to vi.mock factories
const { mockCreateTransaction, mockSnapConstructor } = vi.hoisted(() => {
  const mockCreateTransaction = vi.fn();
  const mockSnapConstructor = vi.fn(function MockSnap() {
    return {
      createTransaction: mockCreateTransaction,
    };
  });
  return { mockCreateTransaction, mockSnapConstructor };
});

// Mock midtrans-client with hoisted mocks
vi.mock("midtrans-client", () => ({
  default: {
    Snap: mockSnapConstructor,
  },
}));

// Mock credentials
vi.mock("@/lib/credentials", () => ({
  decryptCredential: vi.fn((key: string) => `decrypted-${key}`),
}));

// Mock fetch for status lookup
global.fetch = vi.fn();

const MOCK_TENANT = {
  midtransServerKey: "encrypted-server-key",
  midtransClientKey: "encrypted-client-key",
  midtransIsProduction: false,
};

const MOCK_INVOICE = {
  id: "inv-123",
  code: "INV-TEST-001",
  midtransOrderId: "TEST-MIDTRANS-ORDER-123",
  paymentUrl: null,
  snapToken: null,
  grandTotal: 50000,
  customerName: "Test Customer",
  customerPhone: "08123456789",
  customerEmail: "test@example.com",
  itemDetails: [
    { id: "ITEM-1", price: 25000, quantity: 2, name: "Coffee 250g" },
  ],
};

describe("midtrans-gateway", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateTransaction.mockReset();
    mockSnapConstructor.mockClear();
    (global.fetch as any).mockReset();
    vi.resetModules();
  });

  describe("getMidtransTransactionStatus", () => {
    it("returns EXISTS_PAID for settlement", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ transaction_status: "settlement", redirect_url: "https://midtrans.com/redirect", token: "snap-token-123", gross_amount: "50000" }),
      });

      const { getMidtransTransactionStatus: fn } = await import("./midtrans-gateway");
      const result = await fn(MOCK_TENANT, "ORDER-123");
      expect(result.status).toBe("EXISTS_PAID");
    });

    it("returns EXISTS_ACTIVE for pending", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ transaction_status: "pending", redirect_url: "https://midtrans.com/redirect", token: "snap-token-123", gross_amount: "50000" }),
      });

      const { getMidtransTransactionStatus: fn } = await import("./midtrans-gateway");
      const result = await fn(MOCK_TENANT, "ORDER-123");
      expect(result.status).toBe("EXISTS_ACTIVE");
    });

    it("returns EXISTS_TERMINAL for cancel", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ transaction_status: "cancel", redirect_url: null, token: null, gross_amount: "50000" }),
      });

      const { getMidtransTransactionStatus: fn } = await import("./midtrans-gateway");
      const result = await fn(MOCK_TENANT, "ORDER-123");
      expect(result.status).toBe("EXISTS_TERMINAL");
    });

    it("returns NOT_FOUND for 404", async () => {
      (global.fetch as any).mockResolvedValue({ ok: false, status: 404 });
      const { getMidtransTransactionStatus: fn } = await import("./midtrans-gateway");
      const result = await fn(MOCK_TENANT, "ORDER-123");
      expect(result.status).toBe("NOT_FOUND");
    });

    it("returns UPSTREAM_AMBIGUOUS for 500", async () => {
      (global.fetch as any).mockResolvedValue({ ok: false, status: 500, text: async () => "error" });
      const { getMidtransTransactionStatus: fn } = await import("./midtrans-gateway");
      const result = await fn(MOCK_TENANT, "ORDER-123");
      expect(result.status).toBe("UPSTREAM_AMBIGUOUS");
    });

    it("returns UPSTREAM_AMBIGUOUS for network error", async () => {
      (global.fetch as any).mockRejectedValue(new Error("timeout"));
      const { getMidtransTransactionStatus: fn } = await import("./midtrans-gateway");
      const result = await fn(MOCK_TENANT, "ORDER-123");
      expect(result.status).toBe("UPSTREAM_AMBIGUOUS");
    });
  });

  describe("recoverOrInitializeMidtrans", () => {
    it("Window A: NOT_FOUND -> initializes", async () => {
      (global.fetch as any).mockResolvedValueOnce({ ok: false, status: 404 });
      mockCreateTransaction.mockResolvedValue({
        token: "new-token",
        redirect_url: "https://midtrans.com/new",
      });

      const { recoverOrInitializeMidtrans: recover } = await import("./midtrans-gateway");
      const result = await recover(MOCK_TENANT, MOCK_INVOICE);
      expect(result.action).toBe("initialized");
      expect(result.paymentUrl).toBe("https://midtrans.com/new");
    });

    it("Window D: existing paymentUrl -> noop", async () => {
      const invoice = { ...MOCK_INVOICE, paymentUrl: "https://existing.url", snapToken: "existing-token" };
      const { recoverOrInitializeMidtrans: recover } = await import("./midtrans-gateway");
      const result = await recover(MOCK_TENANT, invoice);
      expect(result.action).toBe("noop");
      expect(result.paymentUrl).toBe("https://existing.url");
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("Window B: remote PAID -> paid action, no new Snap", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ transaction_status: "settlement", redirect_url: "https://midtrans.com/redirect", token: "paid-token", gross_amount: "50000" }),
      });

      const { recoverOrInitializeMidtrans: recover } = await import("./midtrans-gateway");
      const result = await recover(MOCK_TENANT, MOCK_INVOICE);
      expect(result.action).toBe("paid");
      expect(mockCreateTransaction).not.toHaveBeenCalled();
    });

    it("Window B: remote ACTIVE -> recovers with the same logical order_id", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ transaction_status: "pending", redirect_url: "https://midtrans.com/redirect", token: "snap-token-123", gross_amount: "50000" }),
      });
      mockCreateTransaction.mockResolvedValue({
        token: "recovered-token",
        redirect_url: "https://midtrans.com/recovered",
      });

      const { recoverOrInitializeMidtrans: recover } = await import("./midtrans-gateway");
      const result = await recover(MOCK_TENANT, MOCK_INVOICE);
      expect(result.action).toBe("recovered");
      expect(result.paymentUrl).toBe("https://midtrans.com/recovered");
      expect(mockCreateTransaction).toHaveBeenCalledTimes(1);
      const params = mockCreateTransaction.mock.calls[0]?.[0] as {
        transaction_details?: { order_id?: string };
      };
      expect(params.transaction_details?.order_id).toBe(MOCK_INVOICE.midtransOrderId);
    });

    it("Window C: status lookup timeout -> ambiguous, durable", async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error("timeout"));

      const { recoverOrInitializeMidtrans: recover } = await import("./midtrans-gateway");
      const result = await recover(MOCK_TENANT, MOCK_INVOICE);
      expect(result.action).toBe("ambiguous");
      expect(result.paymentUrl).toBeNull();
      expect(mockCreateTransaction).not.toHaveBeenCalled();
    });
  });
});