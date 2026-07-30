import type { AccountType, Prisma } from "@prisma/client";

export type CoaAccountDef = {
  code: string;
  name: string;
  type: AccountType;
  isSystem?: boolean;
};

const MEDIUM_TEMPLATE: CoaAccountDef[] = [
  // ── ASSET (1) ──
  { code: "1-1000", name: "Kas Operasional", type: "ASSET", isSystem: true },
  { code: "1-1010", name: "Bank BCA", type: "ASSET" },
  { code: "1-1020", name: "Bank Mandiri", type: "ASSET" },
  { code: "1-1100", name: "Piutang Usaha", type: "ASSET", isSystem: true },
  { code: "1-1200", name: "Persediaan Green Bean", type: "ASSET", isSystem: true },
  { code: "1-1210", name: "Persediaan Roasted Bean", type: "ASSET", isSystem: true },
  { code: "1-1220", name: "Persediaan Produk Jadi", type: "ASSET", isSystem: true },
  { code: "1-1230", name: "Persediaan Kemasan", type: "ASSET", isSystem: true },
  { code: "1-1300", name: "Peralatan Produksi", type: "ASSET" },
  { code: "1-1310", name: "Akumulasi Penyusutan Peralatan", type: "ASSET" },

  // ── LIABILITY (2) ──
  { code: "2-1000", name: "Utang Usaha", type: "LIABILITY", isSystem: true },
  { code: "2-1100", name: "Utang Pajak", type: "LIABILITY" },
  { code: "2-1200", name: "Utang Bank", type: "LIABILITY" },

  // ── EQUITY (3) ──
  { code: "3-1000", name: "Modal Pemilik", type: "EQUITY", isSystem: true },
  { code: "3-1010", name: "Prive / Penarikan Pemilik", type: "EQUITY", isSystem: true },
  { code: "3-1020", name: "Laba Ditahan", type: "EQUITY", isSystem: true },
  { code: "3-1030", name: "Laba Tahun Berjalan", type: "EQUITY", isSystem: true },

  // ── REVENUE (4) ──
  { code: "4-1000", name: "Pendapatan Penjualan Produk Jadi", type: "REVENUE", isSystem: true },
  { code: "4-1010", name: "Pendapatan Penjualan Roasted Bean", type: "REVENUE" },
  { code: "4-1020", name: "Pendapatan Lain-lain", type: "REVENUE" },

  // ── COGS / EXPENSE (5) ──
  { code: "5-1000", name: "HPP - Bahan Baku", type: "EXPENSE", isSystem: true },
  { code: "5-1010", name: "HPP - Tenaga Kerja Langsung", type: "EXPENSE", isSystem: true },
  { code: "5-1020", name: "HPP - Overhead Pabrik", type: "EXPENSE", isSystem: true },
  { code: "5-1030", name: "HPP - Kemasan", type: "EXPENSE", isSystem: true },
  { code: "5-1040", name: "Selisih Penyesuaian Persediaan", type: "EXPENSE", isSystem: true },
  { code: "5-2000", name: "Beban Gaji & Tunjangan", type: "EXPENSE" },
  { code: "5-2010", name: "Beban Sewa", type: "EXPENSE" },
  { code: "5-2020", name: "Beban Utilitas", type: "EXPENSE" },
  { code: "5-2030", name: "Beban Operasional", type: "EXPENSE" },
  { code: "5-2040", name: "Beban Penyusutan", type: "EXPENSE" },
  { code: "5-2050", name: "Beban Pemasaran", type: "EXPENSE" },
  { code: "5-2060", name: "Beban Lain-lain", type: "EXPENSE" },
];

const SMALL_TEMPLATE: CoaAccountDef[] = MEDIUM_TEMPLATE.filter((a) =>
  !a.code.startsWith("1-101") && !a.code.startsWith("1-102") &&
  !a.code.startsWith("1-130") && !a.code.startsWith("1-131") &&
  !a.code.startsWith("5-205") && !a.code.startsWith("5-204")
);

const MICRO_TEMPLATE: CoaAccountDef[] = [
  { code: "1-1000", name: "Kas", type: "ASSET", isSystem: true },
  { code: "1-1100", name: "Piutang", type: "ASSET", isSystem: true },
  { code: "1-1200", name: "Persediaan", type: "ASSET", isSystem: true },
  { code: "1-1300", name: "Peralatan", type: "ASSET" },
  { code: "2-1000", name: "Utang Usaha", type: "LIABILITY", isSystem: true },
  { code: "3-1000", name: "Modal", type: "EQUITY", isSystem: true },
  { code: "3-1010", name: "Prive", type: "EQUITY", isSystem: true },
  { code: "3-1020", name: "Laba Ditahan", type: "EQUITY", isSystem: true },
  { code: "4-1000", name: "Pendapatan", type: "REVENUE", isSystem: true },
  { code: "5-1000", name: "HPP", type: "EXPENSE", isSystem: true },
  { code: "5-1040", name: "Selisih Penyesuaian Persediaan", type: "EXPENSE", isSystem: true },
  { code: "5-2000", name: "Beban Operasional", type: "EXPENSE" },
  { code: "5-2060", name: "Beban Lain-lain", type: "EXPENSE" },
];

const TEMPLATES = {
  MICRO: MICRO_TEMPLATE,
  SMALL: SMALL_TEMPLATE,
  MEDIUM: MEDIUM_TEMPLATE,
} as const;

export type CoaTemplateSize = keyof typeof TEMPLATES;

export function getCoaTemplate(size: CoaTemplateSize): CoaAccountDef[] {
  return TEMPLATES[size];
}

export function getDefaultCoaTemplate(): CoaAccountDef[] {
  return TEMPLATES.MEDIUM;
}

/**
 * Ensure every system posting account exists without overwriting tenant customizations.
 * Safe to call inside the same transaction as a business operation.
 */
export async function ensureDefaultChartOfAccounts(
  tx: Pick<Prisma.TransactionClient, "account">,
  tenantId: string,
): Promise<void> {
  await tx.account.createMany({
    data: getDefaultCoaTemplate().map((account) => ({
      tenantId,
      code: account.code,
      name: account.name,
      type: account.type,
      isSystem: account.isSystem ?? false,
    })),
    skipDuplicates: true,
  });
}
