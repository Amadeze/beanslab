import { describe, expect, it, vi } from "vitest";
import { queryReports } from "./ai-insights";

function createPrismaMock() {
  return {
    invoice: {
      findMany: vi.fn().mockResolvedValue([
        {
          subtotal: 1_000_000,
          discount: 100_000,
          tax: 99_000,
          customer: { name: "Kafe Papua" },
          items: [
            {
              quantity: 10,
              subtotal: 1_000_000,
              hpp: 50_000,
              product: { type: "FINISHED_GOODS", name: "House Blend" },
            },
          ],
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
        voidAt: null,
        status: { in: ["ISSUED", "PARTIAL", "PAID"] },
      }),
    }));
  });
});
