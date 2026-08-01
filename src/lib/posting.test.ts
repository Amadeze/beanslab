import { beforeEach, describe, expect, it, vi } from "vitest";

let journalEntryCreateArgs: any = null;
let transactionCallback: any = null;

vi.mock("@/lib/date-utils", () => ({
  getCurrentDate: vi.fn(() => new Date("2026-07-27")),
}));

const mockTx = {
  journalEntry: {
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({}),
    create: vi.fn((args: any) => {
      journalEntryCreateArgs = args;
      return { id: "je-1", code: "JE-2026-07-001" };
    }),
  },
  account: {
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
    findUnique: vi.fn(({ where }: any) => {
      const codeMap: Record<string, string> = {
        "1-1000": "acct-kas",
        "1-1100": "acct-piutang",
        "1-1200": "acct-gb",
        "1-1210": "acct-rb",
        "1-1220": "acct-fg",
        "1-1230": "acct-kemasan",
        "2-1000": "acct-hutang",
        "3-1000": "acct-modal",
        "3-1010": "acct-prive",
        "4-1000": "acct-penjualan",
        "5-1000": "acct-hpp",
        "5-1010": "acct-tk",
        "5-1020": "acct-overhead",
        "5-1030": "acct-kemasan-hpp",
        "5-1040": "acct-opname",
        "5-2050": "acct-pemasaran",
      };
      const code = where?.tenantId_code?.code;
      return code ? { id: codeMap[code] ?? `acct-${code}` } : null;
    }),
  },
};

vi.mock("@/lib/auth", () => ({
  getCurrentTenantId: vi.fn().mockResolvedValue("tenant-1"),
  getSystemUserId: vi.fn().mockResolvedValue("user-1"),
  requireRole: vi.fn(),
  requireTenantPrisma: vi.fn().mockResolvedValue({
    $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
      transactionCallback = cb;
      return cb(mockTx);
    }),
  }),
}));

import {
  postCreditNote,
  postProductionBatch,
  postRoastingBatch,
  postSalesInvoice,
  postCustomerPayment,
  postExpense,
  postCapitalInjection,
  postOwnerWithdrawal,
  postSupplierPayment,
  postPurchase,
  postStockAdjustment,
  postSampleUsage,
  postVoidReversal,
} from "./posting";

function getCreatedLines(): any {
  if (!journalEntryCreateArgs) return null;
  return {
    date: journalEntryCreateArgs.data.date,
    description: journalEntryCreateArgs.data.description,
    reference: journalEntryCreateArgs.data.reference,
    refType: journalEntryCreateArgs.data.refType,
    lines: journalEntryCreateArgs.data.lines.create.map((l: any) => ({
      accountId: l.accountId,
      debit: Number(l.debit),
      credit: Number(l.credit),
    })),
  };
}

/** Reverse map an acct-XXXX id back to its code. */
function acctCode(acctId: string): string {
  const map: Record<string, string> = {
    "acct-kas": "1-1000",
    "acct-piutang": "1-1100",
    "acct-gb": "1-1200",
    "acct-rb": "1-1210",
    "acct-fg": "1-1220",
    "acct-kemasan": "1-1230",
    "acct-hutang": "2-1000",
    "acct-modal": "3-1000",
    "acct-prive": "3-1010",
    "acct-penjualan": "4-1000",
    "acct-hpp": "5-1000",
    "acct-tk": "5-1010",
    "acct-overhead": "5-1020",
    "acct-kemasan-hpp": "5-1030",
    "acct-opname": "5-1040",
    "acct-pemasaran": "5-2050",
  };
  return map[acctId] ?? acctId.replace("acct-", "");
}

function expectLine(result: any, expectedCode: string, debit: number, credit: number) {
  const line = result.lines.find(
    (l: any) => acctCode(l.accountId) === expectedCode && Number(l.debit) === debit && Number(l.credit) === credit,
  );
  expect(line,
    `Expected line: { code: ${expectedCode}, debit: ${debit}, credit: ${credit} } not found in [\n${
      result.lines.map((l: any) => `  { code: ${acctCode(l.accountId)}, debit: ${l.debit}, credit: ${l.credit} }`).join("\n")
    }\n]`,
  ).toBeTruthy();
}

beforeEach(() => {
  vi.clearAllMocks();
  journalEntryCreateArgs = null;
  transactionCallback = null;
  mockTx.journalEntry.findFirst.mockResolvedValue(null);
});

describe("journal idempotency", () => {
  it("returns the existing journal code for the same source reference", async () => {
    mockTx.journalEntry.findFirst.mockResolvedValueOnce({ code: "JE-EXISTING" });

    const code = await postSalesInvoice("inv-existing", 150_000, 150_000, "Budi");

    expect(code).toBe("JE-EXISTING");
    expect(mockTx.journalEntry.create).not.toHaveBeenCalled();
    expect(mockTx.account.createMany).not.toHaveBeenCalled();
  });
});

describe("postVoidReversal", () => {
  it("swaps debit and credit and marks the source journal void", async () => {
    mockTx.journalEntry.findMany
      .mockResolvedValueOnce([
        {
          id: "source-je",
          description: "Penjualan INV-1",
          lines: [
            { sideId: 0, debit: 200_000, credit: 0, account: { code: "1-1100" } },
            { sideId: 1, debit: 0, credit: 200_000, account: { code: "4-1000" } },
          ],
        },
      ]);

    await postVoidReversal("INVOICE", "invoice-1", "Salah input", {
      tx: mockTx,
      tenantId: "tenant-1",
      userId: "user-1",
    });

    const result = getCreatedLines();
    expect(result.refType).toBe("VOID_REVERSAL");
    expectLine(result, "4-1000", 200_000, 0);
    expectLine(result, "1-1100", 0, 200_000);
    expect(mockTx.journalEntry.update).toHaveBeenCalledWith({
      where: { id: "source-je" },
      data: { voidAt: new Date("2026-07-27"), voidReason: "Salah input" },
    });
  });
});

describe("postCreditNote", () => {
  it("debits revenue and credits receivable", async () => {
    await postCreditNote("cn-1", 500_000, "INV-001");
    const result = getCreatedLines();
    expect(result.description).toBe("Retur penjualan — INV-001");
    expect(result.refType).toBe("CREDIT_NOTE");
    expectLine(result, "4-1000", 500_000, 0);
    expectLine(result, "1-1100", 0, 500_000);
  });

  it("reverses COGS and restores inventory for returned goods", async () => {
    await postCreditNote("cn-2", 500_000, "INV-002", [
      { productType: "FINISHED_GOODS", hpp: 120_000, quantity: 2 },
    ]);
    const result = getCreatedLines();
    expectLine(result, "1-1220", 240_000, 0);
    expectLine(result, "5-1000", 0, 240_000);
  });
});

describe("postProductionBatch", () => {
  it("posts FG debit and credits RB, packaging, capitalizes labor and overhead", async () => {
    await postProductionBatch("batch-1", 1_000_000, 200_000, 300_000, 100_000, "Kopi Tubruk 200g");
    const result = getCreatedLines();
    const totalDebit = result.lines.reduce((s: number, l: any) => s + l.debit, 0);
    const totalCredit = result.lines.reduce((s: number, l: any) => s + l.credit, 0);
    expect(totalDebit).toBe(totalCredit);
    expectLine(result, "1-1220", 1_600_000, 0);
    expectLine(result, "1-1210", 0, 1_000_000);
    expectLine(result, "1-1230", 0, 200_000);
    expectLine(result, "5-1010", 0, 300_000);
    expectLine(result, "5-1020", 0, 100_000);
  });

  it("skips labor/overhead lines when zero", async () => {
    await postProductionBatch("batch-2", 500_000, 100_000, 0, 0, "Kopi Sachet");
    const result = getCreatedLines();
    expect(result.lines).toHaveLength(3);
    expectLine(result, "1-1220", 600_000, 0);
    expect(result.lines.filter((l: any) => acctCode(l.accountId) === "5-1010" || acctCode(l.accountId) === "5-1020")).toHaveLength(0);
  });
});

describe("postRoastingBatch", () => {
  it("capitalizes normal shrinkage into RB inventory", async () => {
    await postRoastingBatch("roast-1", 500_000, 10, 8, "Robusta Green", "Robusta Dark");
    const result = getCreatedLines();
    const totalDebit = result.lines.reduce((s: number, l: any) => s + l.debit, 0);
    const totalCredit = result.lines.reduce((s: number, l: any) => s + l.credit, 0);
    expect(Math.abs(totalDebit - totalCredit)).toBeLessThan(0.01);
    expectLine(result, "1-1210", 500_000, 0);
    expectLine(result, "1-1200", 0, 500_000);
    expect(result.lines).toHaveLength(2);
  });

  it("handles full loss (output = 0)", async () => {
    await postRoastingBatch("roast-2", 300_000, 5, 0, "Arabica Green", "Arabica Light");
    const result = getCreatedLines();
    expectLine(result, "5-1000", 300_000, 0);
    expectLine(result, "1-1200", 0, 300_000);
  });
});

describe("postSalesInvoice", () => {
  it("debits receivable/cash and credits revenue", async () => {
    await postSalesInvoice("inv-1", 150_000, 100_000, "Budi");
    const result = getCreatedLines();
    const totalDebit = result.lines.reduce((s: number, l: any) => s + l.debit, 0);
    const totalCredit = result.lines.reduce((s: number, l: any) => s + l.credit, 0);
    expect(Math.abs(totalDebit - totalCredit)).toBeLessThan(0.01);
    expectLine(result, "1-1100", 50_000, 0);
    expectLine(result, "1-1000", 100_000, 0);
    expectLine(result, "4-1000", 0, 150_000);
  });
});

describe("postCustomerPayment", () => {
  it("debits cash and credits receivable", async () => {
    await postCustomerPayment("pay-1", 50_000, "INV-001", "Budi");
    const result = getCreatedLines();
    expectLine(result, "1-1000", 50_000, 0);
    expectLine(result, "1-1100", 0, 50_000);
  });
});

describe("postExpense", () => {
  it("debits expense account per category and credits cash", async () => {
    await postExpense("exp-1", 25_000, "UTILITAS", "Listrik");
    const result = getCreatedLines();
    expectLine(result, "5-2020", 25_000, 0);
    expectLine(result, "1-1000", 0, 25_000);
  });
});

describe("postCapitalInjection", () => {
  it("debits cash and credits capital", async () => {
    await postCapitalInjection("cap-1", 10_000_000, "Setoran modal awal");
    const result = getCreatedLines();
    expectLine(result, "1-1000", 10_000_000, 0);
    expectLine(result, "3-1000", 0, 10_000_000);
  });
});

describe("postOwnerWithdrawal", () => {
  it("debits prive account and credits cash", async () => {
    await postOwnerWithdrawal("wd-1", 2_000_000, "Prive");
    const result = getCreatedLines();
    expectLine(result, "3-1010", 2_000_000, 0);
    expectLine(result, "1-1000", 0, 2_000_000);
  });
});

describe("postSupplierPayment", () => {
  it("debits AP and credits cash", async () => {
    await postSupplierPayment("sp-1", 3_000_000, "PO-001", "PT Kopi");
    const result = getCreatedLines();
    expectLine(result, "2-1000", 3_000_000, 0);
    expectLine(result, "1-1000", 0, 3_000_000);
  });
});

describe("journal balance invariant", () => {
  it("all posted entries have balanced debit and credit", async () => {
    await postSalesInvoice("inv-1", 150_000, 100_000, "Budi");
    const result = getCreatedLines();
    const totalDebit = result.lines.reduce((s: number, l: any) => s + l.debit, 0);
    const totalCredit = result.lines.reduce((s: number, l: any) => s + l.credit, 0);
    expect(totalDebit).toBe(totalCredit);
  });
});

describe("postSalesInvoice with COGS", () => {
  it("posts revenue, receivable, and COGS lines", async () => {
    await postSalesInvoice("inv-1", 200_000, 200_000, "Budi", [
      { productType: "FINISHED_GOODS", hpp: 120_000, quantity: 2 },
    ]);
    const result = getCreatedLines();
    const totalDebit = result.lines.reduce((s: number, l: any) => s + l.debit, 0);
    const totalCredit = result.lines.reduce((s: number, l: any) => s + l.credit, 0);
    expect(Math.abs(totalDebit - totalCredit)).toBeLessThan(0.01);
    expectLine(result, "1-1000", 200_000, 0);
    expectLine(result, "4-1000", 0, 200_000);
    expectLine(result, "5-1000", 240_000, 0);
    expectLine(result, "1-1220", 0, 240_000);
  });
});

describe("postPurchase", () => {
  it("debits inventory and credits cash + AP for green bean", async () => {
    await postPurchase("pur-1", "GREEN_BEAN", 1_000_000, 400_000, "Supplier A");
    const result = getCreatedLines();
    expectLine(result, "1-1200", 1_000_000, 0);
    expectLine(result, "1-1000", 0, 400_000);
    expectLine(result, "2-1000", 0, 600_000);
  });

  it("credits only AP when unpaid", async () => {
    await postPurchase("pur-2", "GREEN_BEAN", 800_000, 0, "Supplier B");
    const result = getCreatedLines();
    expectLine(result, "1-1200", 800_000, 0);
    expectLine(result, "2-1000", 0, 800_000);
  });

  it("credits only cash when fully paid", async () => {
    await postPurchase("pur-3", "PACKAGING", 500_000, 500_000, "Supplier C");
    const result = getCreatedLines();
    expectLine(result, "1-1230", 500_000, 0);
    expectLine(result, "1-1000", 0, 500_000);
  });
});

describe("postStockAdjustment", () => {
  it("debits inventory and credits adjustment-loss for OUT", async () => {
    await postStockAdjustment("adj-1", "FINISHED_GOODS", "OUT", 10, 15_000);
    const result = getCreatedLines();
    expectLine(result, "5-1040", 150_000, 0);
    expectLine(result, "1-1220", 0, 150_000);
  });

  it("debits adjustment-gain and credits inventory for IN", async () => {
    await postStockAdjustment("adj-2", "ROASTED_BEAN", "IN", 5, 50_000);
    const result = getCreatedLines();
    expectLine(result, "1-1210", 250_000, 0);
    expectLine(result, "5-1040", 0, 250_000);
  });
});

describe("postSampleUsage", () => {
  it("debits marketing expense and credits mixed inventory", async () => {
    await postSampleUsage("smp-1", 75_000, [
      { productType: "FINISHED_GOODS", totalCost: 45_000 },
      { productType: "PACKAGING", totalCost: 30_000 },
    ]);
    const result = getCreatedLines();
    expectLine(result, "5-2050", 75_000, 0);
    expectLine(result, "1-1220", 0, 45_000);
    expectLine(result, "1-1230", 0, 30_000);
  });
});
