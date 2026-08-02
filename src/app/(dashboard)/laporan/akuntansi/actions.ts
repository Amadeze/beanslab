"use server";

import { getCurrentTenantId, requireFeature, requireRole, requireTenantPrisma, getTenantTimezone } from "@/lib/auth";
import { dateToLocalRange } from "@/lib/date-utils";
import { revalidatePath } from "next/cache";

export type CoaRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
  isSystem: boolean;
};

export type JournalEntryRow = {
  id: string;
  code: string;
  date: string;
  description: string;
  reference: string | null;
  refType: string | null;
  lines: { accountCode: string; accountName: string; debit: number; credit: number }[];
  totalDebit: number;
  totalCredit: number;
};

export async function getChartOfAccounts(): Promise<CoaRow[]> {
  await requireRole("OWNER", "MANAGER");
  const tp = await requireTenantPrisma();
  const accounts = await tp.account.findMany({
    orderBy: [{ type: "asc" }, { code: "asc" }],
    select: { id: true, code: true, name: true, type: true, isActive: true, isSystem: true },
  });
  return accounts;
}

export async function getJournalEntries(limit = 50): Promise<JournalEntryRow[]> {
  await requireRole("OWNER", "MANAGER");
  const tp = await requireTenantPrisma();
  const entries = await tp.journalEntry.findMany({
    orderBy: { date: "desc" },
    take: limit,
    include: {
      lines: {
        orderBy: { sideId: "asc" },
        include: { account: { select: { code: true, name: true } } },
      },
    },
  });
  return entries.map((e) => {
    const lines = e.lines.map((l) => ({
      accountCode: l.account.code,
      accountName: l.account.name,
      debit: Number(l.debit),
      credit: Number(l.credit),
    }));
    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
    return {
      id: e.id,
      code: e.code,
      date: e.date.toISOString(),
      description: e.description,
      reference: e.reference,
      refType: e.refType,
      lines,
      totalDebit,
      totalCredit,
    };
  });
}

export async function toggleAccountStatus(accountId: string, isActive: boolean) {
  await requireRole("OWNER");
  const tenantId = await getCurrentTenantId();
  const tp = await requireTenantPrisma();
  const account = await tp.account.findUnique({ where: { id: accountId }, select: { tenantId: true, isSystem: true } });
  if (!account || account.tenantId !== tenantId) throw new Error("Akun tidak ditemukan");
  if (account.isSystem) throw new Error("Akun sistem tidak dapat dinonaktifkan");
  await tp.account.update({ where: { id: accountId }, data: { isActive } });
  revalidatePath("/laporan/akuntansi");
}

export async function createAccount(data: { code: string; name: string; type: string }) {
  await requireRole("OWNER");
  const tenantId = await getCurrentTenantId();
  const tp = await requireTenantPrisma();
  const code = data.code.trim();
  const name = data.name.trim();
  if (!code) throw new Error("Kode akun wajib diisi");
  if (!name) throw new Error("Nama akun wajib diisi");
  const validTypes = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];
  if (!validTypes.includes(data.type)) throw new Error("Tipe akun tidak valid");
  const existing = await tp.account.findUnique({ where: { tenantId_code: { tenantId, code } } });
  if (existing) throw new Error(`Kode akun "${code}" sudah digunakan`);
  await tp.account.create({ data: { code, name, type: data.type as any, tenantId } });
  revalidatePath("/laporan/akuntansi");
}

export async function updateAccount(accountId: string, data: { code?: string; name?: string; isActive?: boolean }) {
  await requireRole("OWNER");
  const tenantId = await getCurrentTenantId();
  const tp = await requireTenantPrisma();
  const account = await tp.account.findUnique({ where: { id: accountId }, select: { tenantId: true, isSystem: true } });
  if (!account || account.tenantId !== tenantId) throw new Error("Akun tidak ditemukan");
  if (account.isSystem && data.code) throw new Error("Kode akun sistem tidak dapat diubah");
  if (data.code) {
    const existing = await tp.account.findUnique({ where: { tenantId_code: { tenantId, code: data.code.trim() } } });
    if (existing && existing.id !== accountId) throw new Error(`Kode akun "${data.code}" sudah digunakan`);
  }
  const updateData: any = {};
  if (data.code !== undefined) updateData.code = data.code.trim();
  if (data.name !== undefined) updateData.name = data.name.trim();
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  await tp.account.update({ where: { id: accountId }, data: updateData });
  revalidatePath("/laporan/akuntansi");
}

export type TrialBalanceRow = {
  accountCode: string;
  accountName: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
};

export async function getTrialBalance(): Promise<TrialBalanceRow[]> {
  await requireRole("OWNER", "MANAGER");
  const tenantId = await getCurrentTenantId();
  const tp = await requireTenantPrisma();

  const accounts = await tp.account.findMany({
    where: { isActive: true },
    orderBy: [{ type: "asc" }, { code: "asc" }],
    select: { id: true, code: true, name: true, type: true },
  });

  const accountIds = accounts.map((a) => a.id);
  if (accountIds.length === 0) return [];

  const lines = await tp.journalLine.groupBy({
    by: ["accountId"],
    where: { accountId: { in: accountIds } },
    _sum: { debit: true, credit: true },
  });

  const balanceMap = new Map(lines.map((l) => [
    l.accountId,
    { debit: Number(l._sum.debit ?? 0), credit: Number(l._sum.credit ?? 0) },
  ]));

  return accounts.map((a) => {
    const b = balanceMap.get(a.id) ?? { debit: 0, credit: 0 };
    const balance = a.type === "ASSET" || a.type === "EXPENSE"
      ? b.debit - b.credit
      : b.credit - b.debit;
    return {
      accountCode: a.code,
      accountName: a.name,
      type: a.type,
      debit: b.debit,
      credit: b.credit,
      balance,
    };
  });
}

export type BukuBesarLine = {
  date: string;
  journalCode: string;
  description: string;
  refType: string | null;
  reference: string | null;
  debit: number;
  credit: number;
  balance: number;
};

export type BukuBesarData = {
  accountCode: string;
  accountName: string;
  accountType: string;
  openingBalance: number;
  lines: BukuBesarLine[];
  closingBalance: number;
};

// =============================================================================
// NERACA LAJUR (10-Column Worksheet)
// =============================================================================

export type NeracaLajurRow = {
  accountCode: string;
  accountName: string;
  type: string;
  tbDebit: number;
  tbCredit: number;
  plDebit: number;
  plCredit: number;
  neracaDebit: number;
  neracaCredit: number;
};

export async function getNeracaLajur(
  fromDate?: string,
  toDate?: string,
): Promise<NeracaLajurRow[]> {
  await requireFeature("ADVANCED_REPORTS");
  await requireRole("OWNER", "MANAGER");
  const tp = await requireTenantPrisma();
  const timezone = await getTenantTimezone();

  const accounts = await tp.account.findMany({
    where: { isActive: true },
    orderBy: [{ type: "asc" }, { code: "asc" }],
    select: { id: true, code: true, name: true, type: true },
  });

  const accountIds = accounts.map((a) => a.id);
  if (accountIds.length === 0) return [];

  const dateFilter = fromDate || toDate
    ? {
        journalEntry: {
          date: {
            ...(fromDate ? { gte: dateToLocalRange(fromDate, timezone).start } : {}),
            ...(toDate ? { lte: dateToLocalRange(toDate, timezone).end } : {}),
          },
        },
      }
    : {};

  const lines = await tp.journalLine.groupBy({
    by: ["accountId"],
    where: { accountId: { in: accountIds }, ...dateFilter },
    _sum: { debit: true, credit: true },
  });

  const balanceMap = new Map(
    lines.map((l) => [
      l.accountId,
      { debit: Number(l._sum.debit ?? 0), credit: Number(l._sum.credit ?? 0) },
    ]),
  );

  return accounts.map((a) => {
    const b = balanceMap.get(a.id) ?? { debit: 0, credit: 0 };
    const isPL = a.type === "REVENUE" || a.type === "EXPENSE";
    return {
      accountCode: a.code,
      accountName: a.name,
      type: a.type,
      tbDebit: b.debit,
      tbCredit: b.credit,
      plDebit: isPL && b.debit > b.credit ? b.debit - b.credit : isPL ? 0 : 0,
      plCredit: isPL && b.credit > b.debit ? b.credit - b.debit : isPL ? 0 : 0,
      neracaDebit: !isPL && b.debit > b.credit ? b.debit - b.credit : !isPL ? 0 : 0,
      neracaCredit: !isPL && b.credit > b.debit ? b.credit - b.debit : !isPL ? 0 : 0,
    };
  });
}

// =============================================================================
// ARUS KAS (Cash Flow — Direct Method)
// =============================================================================

export type ArusKasRow = {
  category: string;
  label: string;
  amount: number;
};

export async function getArusKas(
  fromDate?: string,
  toDate?: string,
): Promise<ArusKasRow[]> {
  await requireFeature("ADVANCED_REPORTS");
  await requireRole("OWNER", "MANAGER");
  const tp = await requireTenantPrisma();
  const tenantId = await getCurrentTenantId();
  const timezone = await getTenantTimezone();

  const kasAccount = await tp.account.findFirst({
    where: { tenantId, code: "1-1000", isActive: true },
    select: { id: true },
  });
  if (!kasAccount) return [];

  const dateFilter =
    fromDate || toDate
      ? {
          date: {
            ...(fromDate ? { gte: dateToLocalRange(fromDate, timezone).start } : {}),
            ...(toDate ? { lte: dateToLocalRange(toDate, timezone).end } : {}),
          },
        }
      : {};

  const entries = await tp.journalEntry.findMany({
    where: {
      lines: { some: { accountId: kasAccount.id } },
      ...dateFilter,
    },
    orderBy: { date: "asc" },
    select: {
      id: true,
      code: true,
      date: true,
      description: true,
      refType: true,
    },
  });

  const entryIds = entries.map((e) => e.id);
  if (entryIds.length === 0) return [];

  const allLines = await tp.journalLine.findMany({
    where: { journalEntryId: { in: entryIds } },
    include: { account: { select: { code: true, name: true } } },
  });

  const entryLinesMap = new Map<string, typeof allLines>();
  for (const line of allLines) {
    if (!entryLinesMap.has(line.journalEntryId)) entryLinesMap.set(line.journalEntryId, []);
    entryLinesMap.get(line.journalEntryId)!.push(line);
  }

  const categories: ArusKasRow[] = [];
  let operatingIn = 0, operatingOut = 0;
  let investingIn = 0, investingOut = 0;
  let financingIn = 0, financingOut = 0;

  const isRevenue = (code: string) => code.startsWith("4-");
  const isExpense = (code: string) => code.startsWith("5-");
  const isAssetNonKas = (code: string) =>
    code.startsWith("1-") && code !== "1-1000";
  const isLiability = (code: string) => code.startsWith("2-");
  const isEquity = (code: string) => code.startsWith("3-");

  for (const entry of entries) {
    const lines = entryLinesMap.get(entry.id) ?? [];
    const kasLines = lines.filter((l) => l.accountId === kasAccount.id);
    const kasIn = kasLines.reduce((s, l) => s + Number(l.debit), 0);
    const kasOut = kasLines.reduce((s, l) => s + Number(l.credit), 0);
    const otherCodes = lines
      .filter((l) => l.accountId !== kasAccount.id)
      .map((l) => l.account.code);

    const refType = entry.refType;
    if (refType === "SALE" || refType === "INVOICE" || refType === "PAYMENT") {
      operatingIn += kasIn;
      operatingOut += kasOut;
    } else if (refType === "SUPPLIER_PAYMENT" || refType === "PURCHASE") {
      operatingOut += kasOut;
    } else if (refType === "EXPENSE") {
      operatingOut += kasOut;
    } else {
      const hasRevenue = otherCodes.some(isRevenue);
      const hasExpense = otherCodes.some(isExpense);
      const hasAsset = otherCodes.some(isAssetNonKas);
      const hasLiability = otherCodes.some(isLiability);
      const hasEquity = otherCodes.some(isEquity);

      if (hasEquity || (hasLiability && !hasRevenue && !hasExpense)) {
        financingIn += kasIn;
        financingOut += kasOut;
      } else if (hasAsset && !hasRevenue && !hasExpense) {
        investingOut += kasOut;
        investingIn += kasIn;
      } else if (hasRevenue) {
        operatingIn += kasIn;
      } else if (hasExpense) {
        operatingOut += kasOut;
      } else {
        kasIn > kasOut ? (operatingIn += kasIn) : (operatingOut += kasOut);
      }
    }
  }

  const addRow = (cat: string, label: string, amount: number) => {
    categories.push({ category: cat, label, amount });
  };

  addRow("OPERATING", "Penerimaan dari Penjualan", operatingIn);
  addRow("OPERATING", "Pembayaran ke Pemasok", -operatingOut);
  addRow("OPERATING", "Pembayaran Beban Operasional", 0);
  addRow("OPERATING", "Kas Bersih dari Operasi", operatingIn - operatingOut);
  addRow("INVESTING", "Penerimaan dari Investasi", investingIn);
  addRow("INVESTING", "Pembayaran Investasi", -investingOut);
  addRow("INVESTING", "Kas Bersih dari Investasi", investingIn - investingOut);
  addRow("FINANCING", "Penerimaan Pendanaan", financingIn);
  addRow("FINANCING", "Pembayaran Pendanaan", -financingOut);
  addRow("FINANCING", "Kas Bersih dari Pendanaan", financingIn - financingOut);

  return categories;
}

// =============================================================================
// LABA DITAHAN (Retained Earnings)
// =============================================================================

export type LabaDitahanData = {
  openingBalance: number;
  netIncome: number;
  dividends: number;
  closingBalance: number;
};

export async function getLabaDitahan(
  fromDate?: string,
  toDate?: string,
): Promise<LabaDitahanData> {
  await requireFeature("ADVANCED_REPORTS");
  await requireRole("OWNER", "MANAGER");
  const tp = await requireTenantPrisma();
  const tenantId = await getCurrentTenantId();
  const timezone = await getTenantTimezone();

  // Laba ditahan digulir otomatis per laporan: saldo awal = laba ditahan
  // historis (3-1020, bila pernah dijurnal manual) + laba bersih periode sebelum fromDate.
  const retainedEarnings = await tp.account.findFirst({
    where: { tenantId, code: "3-1020", isActive: true },
    select: { id: true },
  });
  const dividendAccount = await tp.account.findFirst({
    where: { tenantId, code: "3-1010", isActive: true },
    select: { id: true },
  });

  const dateFilter =
    fromDate || toDate
      ? {
          journalEntry: {
            date: {
              ...(fromDate ? { gte: dateToLocalRange(fromDate, timezone).start } : {}),
              ...(toDate ? { lte: dateToLocalRange(toDate, timezone).end } : {}),
            },
          },
        }
      : {};

  const beforeFilter = fromDate
    ? { journalEntry: { date: { lt: dateToLocalRange(fromDate, timezone).start } } }
    : {};

  const openingAgg = retainedEarnings
    ? await tp.journalLine.aggregate({
        where: { accountId: retainedEarnings.id, ...beforeFilter },
        _sum: { credit: true, debit: true },
      })
    : { _sum: { credit: 0, debit: 0 } };
  const openingRetained =
    Number(openingAgg._sum.credit ?? 0) - Number(openingAgg._sum.debit ?? 0);

  const revenueAccounts = await tp.account.findMany({
    where: { tenantId, type: "REVENUE", isActive: true },
    select: { id: true },
  });
  const expenseAccounts = await tp.account.findMany({
    where: { tenantId, type: "EXPENSE", isActive: true },
    select: { id: true },
  });

  const revIds = revenueAccounts.map((a) => a.id);
  const expIds = expenseAccounts.map((a) => a.id);

  const revenueAgg =
    revIds.length > 0
      ? await tp.journalLine.aggregate({
          where: { accountId: { in: revIds }, ...dateFilter },
          _sum: { credit: true, debit: true },
        })
      : { _sum: { credit: 0, debit: 0 } };
  const totalRevenue =
    Number(revenueAgg._sum.credit ?? 0) - Number(revenueAgg._sum.debit ?? 0);

  const expenseAgg =
    expIds.length > 0
      ? await tp.journalLine.aggregate({
          where: { accountId: { in: expIds }, ...dateFilter },
          _sum: { debit: true, credit: true },
        })
      : { _sum: { debit: 0, credit: 0 } };
  const totalExpense =
    Number(expenseAgg._sum.debit ?? 0) - Number(expenseAgg._sum.credit ?? 0);

  const netIncome = totalRevenue - totalExpense;

  // Laba bersih akumulatif sebelum periode berjalan (rollover otomatis).
  const priorRevenueAgg =
    revIds.length > 0
      ? await tp.journalLine.aggregate({
          where: { accountId: { in: revIds }, ...beforeFilter },
          _sum: { credit: true, debit: true },
        })
      : { _sum: { credit: 0, debit: 0 } };
  const priorExpenseAgg =
    expIds.length > 0
      ? await tp.journalLine.aggregate({
          where: { accountId: { in: expIds }, ...beforeFilter },
          _sum: { debit: true, credit: true },
        })
      : { _sum: { debit: 0, credit: 0 } };
  const priorNetIncome =
    Number(priorRevenueAgg._sum.credit ?? 0) -
    Number(priorRevenueAgg._sum.debit ?? 0) -
    (Number(priorExpenseAgg._sum.debit ?? 0) - Number(priorExpenseAgg._sum.credit ?? 0));

  const openingBalance = openingRetained + priorNetIncome;

  const dividendAgg = dividendAccount
    ? await tp.journalLine.aggregate({
        where: { accountId: dividendAccount.id, ...dateFilter },
        _sum: { debit: true },
      })
    : { _sum: { debit: 0 } };
  const dividends = Number(dividendAgg._sum.debit ?? 0);

  return {
    openingBalance,
    netIncome,
    dividends,
    closingBalance: openingBalance + netIncome - dividends,
  };
}

// =============================================================================
// PERUBAHAN EKUITAS (Changes in Equity)
// =============================================================================

export type PerubahanEkuitasRow = {
  component: string;
  openingBalance: number;
  addition: number;
  deduction: number;
  closingBalance: number;
};

export async function getPerubahanEkuitas(
  fromDate?: string,
  toDate?: string,
): Promise<PerubahanEkuitasRow[]> {
  await requireFeature("ADVANCED_REPORTS");
  await requireRole("OWNER", "MANAGER");
  const tp = await requireTenantPrisma();
  const tenantId = await getCurrentTenantId();
  const timezone = await getTenantTimezone();

  const equityAccounts = await tp.account.findMany({
    where: { tenantId, type: "EQUITY", isActive: true },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });

  const dateFilter =
    fromDate || toDate
      ? {
          journalEntry: {
            date: {
              ...(fromDate ? { gte: dateToLocalRange(fromDate, timezone).start } : {}),
              ...(toDate ? { lte: dateToLocalRange(toDate, timezone).end } : {}),
            },
          },
        }
      : {};

  const beforeFilter = fromDate
    ? { journalEntry: { date: { lt: dateToLocalRange(fromDate, timezone).start } } }
    : {};

  const results: PerubahanEkuitasRow[] = [];
  for (const acct of equityAccounts) {
    const openingAgg = await tp.journalLine.aggregate({
      where: { accountId: acct.id, ...beforeFilter },
      _sum: { credit: true, debit: true },
    });
    const opening =
      Number(openingAgg._sum.credit ?? 0) -
      Number(openingAgg._sum.debit ?? 0);

    const periodAgg = await tp.journalLine.aggregate({
      where: { accountId: acct.id, ...dateFilter },
      _sum: { credit: true, debit: true },
    });
    const periodCredit = Number(periodAgg._sum.credit ?? 0);
    const periodDebit = Number(periodAgg._sum.debit ?? 0);

    results.push({
      component: acct.name,
      openingBalance: opening,
      addition: periodCredit,
      deduction: periodDebit,
      closingBalance: opening + periodCredit - periodDebit,
    });
  }

  return results;
}

// =============================================================================
// GL INTEGRITY CHECKS
// =============================================================================

export type GlIntegrityIssue = {
  severity: "ERROR" | "WARNING" | "INFO";
  category: string;
  message: string;
  detail: string;
  entryCode?: string;
  accountCode?: string;
};

export async function getGlIntegrityCheck(): Promise<GlIntegrityIssue[]> {
  await requireFeature("ADVANCED_REPORTS");
  await requireRole("OWNER", "MANAGER");
  const tp = await requireTenantPrisma();
  const issues: GlIntegrityIssue[] = [];

  // Check 1: Unbalanced journal entries
  const entries = await tp.journalEntry.findMany({
    include: {
      lines: { select: { debit: true, credit: true } },
    },
  });

  for (const entry of entries) {
    const totalDebit = entry.lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = entry.lines.reduce((s, l) => s + Number(l.credit), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      issues.push({
        severity: "ERROR",
        category: "UNBALANCED_ENTRY",
        message: `Jurnal ${entry.code} tidak balance`,
        detail: `Debit: ${totalDebit}, Kredit: ${totalCredit}, Selisih: ${(totalDebit - totalCredit).toFixed(2)}`,
        entryCode: entry.code,
      });
    }
  }

  // Check 2: Entries without lines
  const emptyEntries = entries.filter((e) => e.lines.length === 0);
  for (const e of emptyEntries) {
    issues.push({
      severity: "ERROR",
      category: "EMPTY_ENTRY",
      message: `Jurnal ${e.code} tidak memiliki lines`,
      detail: `Tidak ada baris debit/kredit`,
      entryCode: e.code,
    });
  }

  // Check 3: Accounts with negative asset balances
  const accounts = await tp.account.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, type: true },
  });
  const accountIds = accounts.map((a) => a.id);

  if (accountIds.length > 0) {
    const lines = await tp.journalLine.groupBy({
      by: ["accountId"],
      where: { accountId: { in: accountIds } },
      _sum: { debit: true, credit: true },
    });

    const balanceMap = new Map(
      lines.map((l) => [
        l.accountId,
        { debit: Number(l._sum.debit ?? 0), credit: Number(l._sum.credit ?? 0) },
      ]),
    );

    for (const acct of accounts) {
      const b = balanceMap.get(acct.id) ?? { debit: 0, credit: 0 };
      const balance = (acct.type === "ASSET" || acct.type === "EXPENSE")
        ? b.debit - b.credit
        : b.credit - b.debit;

      if (acct.type === "ASSET" && balance < -0.01) {
        issues.push({
          severity: "WARNING",
          category: "NEGATIVE_ASSET",
          message: `Akun aset ${acct.code} ${acct.name} memiliki saldo negatif`,
          detail: `Saldo: ${balance.toFixed(2)}`,
          accountCode: acct.code,
        });
      }

      if (acct.type === "LIABILITY" && balance < -0.01) {
        issues.push({
          severity: "WARNING",
          category: "NEGATIVE_LIABILITY",
          message: `Akun kewajiban ${acct.code} ${acct.name} memiliki saldo negatif`,
          detail: `Saldo: ${balance.toFixed(2)}`,
          accountCode: acct.code,
        });
      }
    }
  }

  return issues;
}

export async function getBukuBesar(
  accountCode: string,
  fromDate?: string,
  toDate?: string,
): Promise<BukuBesarData> {
  await requireFeature("ADVANCED_REPORTS");
  await requireRole("OWNER", "MANAGER");
  const tenantId = await getCurrentTenantId();
  const tp = await requireTenantPrisma();
  const timezone = await getTenantTimezone();

  const account = await tp.account.findUnique({
    where: { tenantId_code: { tenantId, code: accountCode } },
    select: { id: true, code: true, name: true, type: true },
  });
  if (!account) throw new Error("Akun tidak ditemukan");

  const from = fromDate ? dateToLocalRange(fromDate, timezone).start : new Date("2000-01-01T00:00:00.000Z");
  const to = toDate ? dateToLocalRange(toDate, timezone).end : new Date("2100-01-01T00:00:00.000Z");

  const openingAgg = await tp.journalLine.aggregate({
    where: {
      accountId: account.id,
      journalEntry: { date: { lt: from } },
    },
    _sum: { debit: true, credit: true },
  });
  const openingDebit = Number(openingAgg._sum.debit ?? 0);
  const openingCredit = Number(openingAgg._sum.credit ?? 0);
  const isDebitNorm = account.type === "ASSET" || account.type === "EXPENSE";
  const openingBalance = isDebitNorm ? openingDebit - openingCredit : openingCredit - openingDebit;

  const lines = await tp.journalLine.findMany({
    where: {
      accountId: account.id,
      journalEntry: { date: { gte: from, lte: to } },
    },
    orderBy: [{ journalEntry: { date: "asc" } }, { sideId: "asc" }],
    include: {
      journalEntry: {
        select: { code: true, date: true, description: true, refType: true, reference: true },
      },
    },
  });

  let runningBalance = openingBalance;
  const mapped = lines.map((l) => {
    const debit = Number(l.debit);
    const credit = Number(l.credit);
    runningBalance += isDebitNorm ? debit - credit : credit - debit;
    return {
      date: l.journalEntry.date.toISOString(),
      journalCode: l.journalEntry.code,
      description: l.journalEntry.description,
      refType: l.journalEntry.refType,
      reference: l.journalEntry.reference,
      debit,
      credit,
      balance: runningBalance,
    };
  });

  return {
    accountCode: account.code,
    accountName: account.name,
    accountType: account.type,
    openingBalance,
    lines: mapped,
    closingBalance: runningBalance,
  };
}
