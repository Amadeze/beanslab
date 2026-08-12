import { Suspense } from "react";
import { ReportLayout } from "../../_shared/ReportLayout";
import { requireFeature } from "@/lib/auth";
import { getPerubahanEkuitas } from "../actions";
import { PerubahanEkuitasClient } from "./PerubahanEkuitasClient";

export default async function PerubahanEkuitasPage({
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
      data = await getPerubahanEkuitas(params.from, params.to);
    } catch (e: any) {
      error = e.message;
    }
  }

  return (
    <ReportLayout activeTab="akuntansi/perubahan-ekuitas">
      <Suspense fallback={<div className="p-8 text-sm text-slate-400">Memuat...</div>}>
        <PerubahanEkuitasClient data={data} error={error} fromDate={from} toDate={to} />
      </Suspense>
    </ReportLayout>
  );
}
