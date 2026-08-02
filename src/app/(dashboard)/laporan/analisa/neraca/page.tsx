import { Suspense } from "react";
import { ReportLayout, ReportSkeleton } from "../../_shared";
import { BalanceSheetClient } from "../../_components/BalanceSheetClient";
import { getBalanceSheetReport, getInventoryValuationReport } from "../../actions";
import { getTenantTimezone, requireFeature } from "@/lib/auth";
import { dateToLocalRange, getTodayStringForTimezone } from "@/lib/date-utils";

export default async function NeracaPage() {
  await requireFeature("ADVANCED_REPORTS");
  const tz = await getTenantTimezone();
  const { end: asOf } = dateToLocalRange(getTodayStringForTimezone(tz), tz);

  const inventory = await getInventoryValuationReport(asOf);
  const report = await getBalanceSheetReport(inventory.grandTotalValue, asOf);

  return (
    <ReportLayout activeTab="analisa/neraca" title="Neraca">
      <Suspense fallback={<ReportSkeleton />}>
        <BalanceSheetClient report={report} />
      </Suspense>
    </ReportLayout>
  );
}