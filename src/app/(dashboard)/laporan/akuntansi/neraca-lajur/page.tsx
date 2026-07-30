import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { getNeracaLajur } from "../actions";
import { NeracaLajurClient } from "./NeracaLajurClient";

export default async function NeracaLajurPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const from = params.from ?? "";
  const to = params.to ?? "";

  let data = null;
  let error = null;
  if (from || to) {
    try {
      data = await getNeracaLajur(params.from, params.to);
    } catch (e: any) {
      error = e.message;
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Neraca Lajur" description="Kertas kerja 10 kolom — Trial Balance, Laba Rugi, Neraca" />
      <Suspense fallback={<div className="p-8 text-sm text-slate-400">Memuat...</div>}>
        <NeracaLajurClient data={data} error={error} fromDate={from} toDate={to} />
      </Suspense>
    </div>
  );
}
