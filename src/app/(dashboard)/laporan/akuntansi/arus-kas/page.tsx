import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { getArusKas } from "../actions";
import { ArusKasClient } from "./ArusKasClient";

export default async function ArusKasPage({
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
      data = await getArusKas(params.from, params.to);
    } catch (e: any) {
      error = e.message;
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Laporan Arus Kas" description="Metode langsung — Kas masuk & keluar per aktivitas" />
      <Suspense fallback={<div className="p-8 text-sm text-slate-400">Memuat...</div>}>
        <ArusKasClient data={data} error={error} fromDate={from} toDate={to} />
      </Suspense>
    </div>
  );
}
