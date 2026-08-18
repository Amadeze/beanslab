import { describe, expect, it, vi } from "vitest";
import { queryReports } from "./ai-insights";

function createPrismaMock(invoiceOverrides: Record<string, unknown> = {}) {
  return {
    invoice: {
      findMany: vi.fn().mockResolvedValue([
        {
          subtotal: 1_000_000,
          discount: 100_000,
          tax: 99_000,
          returnedAmount: 0,
          customer: { name: "Kafe Papua" },
          items: [
            {
              quantity: 10,
              subtotal: 1_000_000,
              hpp: 50_000,
              product: { type: "FINISHED_GOODS", name: "House Blend" },
            },
          ],
          ...invoiceOverrides,
        },
      ]),
    },
    expense: {
      findMany: vi.fn().mockResolvedValue([{ amount: 100_000 }]),
    },
    sampleUsage: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { totalCost: 25_000 } }),
    },
  };
}

describe("queryReports profit", () => {
  it("uses net sales, COGS, and operating expenses instead of inventory purchases", async () => {
    const prisma = createPrismaMock();

    const result = await queryReports("berapa profit bulan ini?", prisma);

    expect(result.data).toMatchObject({
      revenue: 900_000,
      cogs: 500_000,
      expenses: 100_000,
      sampleCost: 25_000,
      operatingExpenses: 125_000,
      profit: 275_000,
    });
    expect(result.answer).toContain("Laba bersih");
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        deliveredAt: { gte: expect.any(Date), lt: expect.any(Date) },
        voidAt: null,
        status: { in: ["ISSUED", "PARTIAL", "PAID"] },
      }),
    }));
  });

  it("mengabaikan invoice yang belum diserahkan (issuedAt bukan basis)", async () => {
    // Mock hanya dipanggil sekali (fetchProfit) dengan deliveredAt filter —
    // invoice tanpa deliveredAt tidak akan pernah terpilih di query sungguhan.
    const prisma = createPrismaMock();
    const result = await queryReports("keuntungan bulan ini?", prisma);
    expect(result.data).toMatchObject({ revenue: 900_000 });
    const where = prisma.invoice.findMany.mock.calls[0][0].where;
    expect(where.deliveredAt).toBeDefined();
    expect(where.issuedAt).toBeUndefined();
  });

  it("mengurangi retur dari pendapatan AI (net returns)", async () => {
    const prisma = createPrismaMock({ returnedAmount: 200_000 });
    const result = await queryReports("profit bulan ini?", prisma);
    expect(result.data).toMatchObject({ revenue: 700_000 });
  });

  it("nota diretur penuh → pendapatan nol, sisa COGS proporsional", async () => {
    const prisma = createPrismaMock({ returnedAmount: 900_000 });
    const result = await queryReports("profit bulan ini?", prisma);
    // Net sales 0; COGS tersisa 10% (faktor retur), beban tetap.
    expect(result.data).toMatchObject({ revenue: 0, cogs: 50_000, profit: -175_000 });
  });
});

describe("queryReports omzet harian", () => {
  it("menggunakan deliveredAt dan net retur untuk omzet hari ini", async () => {
    const prisma = {
      invoice: {
        findMany: vi.fn().mockResolvedValue([
          { grandTotal: 1_000_000, returnedAmount: 100_000 },
          { grandTotal: 500_000, returnedAmount: 0 },
        ]),
      },
      expense: { findMany: vi.fn().mockResolvedValue([]) },
      sampleUsage: { aggregate: vi.fn().mockResolvedValue({ _sum: { totalCost: 0 } }) },
    };

    const result = await queryReports("omzet hari ini?", prisma, "Asia/Jakarta");

    expect(result.data).toMatchObject({ revenue: 1_400_000, invoiceCount: 2, avgInvoice: 700_000 });
    const where = prisma.invoice.findMany.mock.calls[0][0].where;
    expect(where.deliveredAt).toBeDefined();
    expect(where.issuedAt).toBeUndefined();
  });
});
