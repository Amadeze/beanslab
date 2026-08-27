import { Suspense } from "react";
import { ReportLayout } from "../../_shared/ReportLayout";
import { requireFeature } from "@/lib/auth";
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
  await requireFeature("ADVANCED_REPORTS");

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
    <ReportLayout activeTab="akuntansi/neraca-lajur">
      <Suspense fallback={<div className="p-8 text-sm text-slate-400">Memuat...</div>}>
        <NeracaLajurClient data={data} error={error} fromDate={from} toDate={to} />
      </Suspense>
    </ReportLayout>
  );
}
