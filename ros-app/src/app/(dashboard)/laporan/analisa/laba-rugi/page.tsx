import { Suspense } from "react";
import { ReportLayout, ReportSkeleton } from "../../_shared";
import { PnLReportClient } from "../../_components/PnLReportClient";
import { PnlNavigator } from "../../_components/PnlNavigator";
import { getPnLReport } from "../../../keuangan/actions";
import { requireFeature } from "@/lib/auth";

function clampInt(value: string | undefined, min: number, max: number, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

export default async function LabaRugiPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const now = new Date();
  const params = await searchParams;
  const month = clampInt(params.month, 1, 12, now.getMonth() + 1);
  const year = clampInt(params.year, 2000, 2100, now.getFullYear());

  await requireFeature("ADVANCED_REPORTS");
  const report = await getPnLReport(month, year);

  return (
    <ReportLayout activeTab="keuangan/laba-rugi" title="Laba Rugi">
      <Suspense fallback={<ReportSkeleton />}>
        <PnlNavigator month={month} year={year} />
        <PnLReportClient report={report} hideLayout />
      </Suspense>
    </ReportLayout>
  );
}