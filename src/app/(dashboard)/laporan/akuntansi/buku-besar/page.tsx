import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireFeature } from "@/lib/auth";
import { getChartOfAccounts, getBukuBesar } from "../actions";
import { BukuBesarClient } from "./BukuBesarClient";

export default async function BukuBesarPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  await requireFeature("ADVANCED_REPORTS");
  const accounts = await getChartOfAccounts().catch(() => []);

  let data = null;
  let error = null;
  if (params.account) {
    try {
      data = await getBukuBesar(params.account, params.from, params.to);
    } catch (e: any) {
      error = e.message;
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Buku Besar"
        description="Riwayat mutasi per akun dengan saldo berjalan"
      />
      <Suspense fallback={<div className="p-8 text-sm text-slate-400">Memuat...</div>}>
        <BukuBesarClient
          accounts={accounts}
          data={data}
          error={error}
          selectedAccount={params.account ?? null}
          fromDate={params.from ?? null}
          toDate={params.to ?? null}
        />
      </Suspense>
    </div>
  );
}
