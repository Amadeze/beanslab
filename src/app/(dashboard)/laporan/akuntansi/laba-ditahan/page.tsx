import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireFeature } from "@/lib/auth";
import { getLabaDitahan } from "../actions";
import { LabaDitahanClient } from "./LabaDitahanClient";

export default async function LabaDitahanPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const from = params.from ?? "";
  const to = params.to ?? "";
  await requireFeature("ADVANCED_REPORTS");

  let data = null;
  let error = null;
  if (from || to) {
    try {
      data = await getLabaDitahan(params.from, params.to);
    } catch (e: any) {
      error = e.message;
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Laporan Laba Ditahan" description="Mutasi saldo laba ditahan selama periode" />
      <Suspense fallback={<div className="p-8 text-sm text-slate-400">Memuat...</div>}>
        <LabaDitahanClient data={data} error={error} fromDate={from} toDate={to} />
      </Suspense>
    </div>
  );
}
