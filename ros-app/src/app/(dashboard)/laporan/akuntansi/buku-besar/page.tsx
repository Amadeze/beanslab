import { Suspense } from "react";
import { ReportLayout } from "../../_shared/ReportLayout";
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
    <ReportLayout activeTab="akuntansi/buku-besar">
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
    </ReportLayout>
  );
}
