import { Suspense } from "react";
import { CoaListClient } from "./_components/CoaListClient";
import { getChartOfAccounts, getJournalEntries, getTrialBalance } from "./actions";

export default async function AkuntansiPage() {
  const [accounts, entries, trialBalance] = await Promise.all([
    getChartOfAccounts().catch(() => []),
    getJournalEntries().catch(() => []),
    getTrialBalance().catch(() => []),
  ]);

  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-400">Memuat...</div>}>
      <CoaListClient accounts={accounts} entries={entries} trialBalance={trialBalance} />
    </Suspense>
  );
}
