import { Suspense } from "react";
import { ReportLayout } from "../_shared/ReportLayout";
import { CoaListClient } from "./_components/CoaListClient";
import { getChartOfAccounts, getJournalEntries, getTrialBalance } from "./actions";

export default async function AkuntansiPage() {
  const [accounts, entries, trialBalance] = await Promise.all([
    getChartOfAccounts(),
    getJournalEntries(),
    getTrialBalance(),
  ]);

  return (
    <ReportLayout activeTab="akuntansi">
      <Suspense fallback={<div className="p-8 text-sm text-slate-400">Memuat...</div>}>
        <CoaListClient accounts={accounts} entries={entries} trialBalance={trialBalance} embedded />
      </Suspense>
    </ReportLayout>
  );
}
