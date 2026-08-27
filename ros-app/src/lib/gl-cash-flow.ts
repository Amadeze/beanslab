/**
 * Arus kas BERDASARKAN BUKU BESAR (GL) — bukan revenue − expenses.
 *
 * Definisi 2F.2: arus kas = pergerakan nyata kas pada akun 1-1000 (Cash)
 * dalam periode. Kas masuk (kredit) dan kas keluar (debit) dijumlahkan dari
 * jurnal; setiap jurnal termasuk pembaliknya (VOID_REVERSAL, Model A),
 * sehingga pembatalan transaksi otomatis menjadi arus kas balik yang benar.
 */
type CashLineRow = {
  debit: unknown;
  credit: unknown;
};

type JournalLineClient = {
  journalLine: {
    findMany: (args: {
      where: Record<string, unknown>;
      select: { debit: true; credit: true };
    }) => Promise<CashLineRow[]>;
  };
};

export async function computeCashMovement(input: {
  tp: JournalLineClient;
  tenantId: string;
  start: Date;
  end: Date;
}): Promise<{ inflow: number; outflow: number; net: number }> {
  const rows = await input.tp.journalLine.findMany({
    where: {
      account: { tenantId: input.tenantId, code: "1-1000" },
      journalEntry: { date: { gte: input.start, lt: input.end } },
    },
    select: { debit: true, credit: true },
  });

  let inflow = 0;
  let outflow = 0;
  for (const row of rows) {
    // Kas adalah akun aset: kas MASUK = debit, kas KELUAR = kredit.
    inflow += Number(row.debit);
    outflow += Number(row.credit);
  }
  return { inflow, outflow, net: inflow - outflow };
}