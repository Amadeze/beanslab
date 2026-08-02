import { Suspense } from "react";
import { ReportLayout, ReportSkeleton } from "../../_shared";
import { InventoryValuationClient } from "../../_components/InventoryValuationClient";
import { getInventoryValuationReport } from "../../actions";
import { getTenantTimezone, requireFeature } from "@/lib/auth";
import { dateToLocalRange, getTodayStringForTimezone } from "@/lib/date-utils";

export default async function NilaiStokPage() {
  await requireFeature("ADVANCED_REPORTS");
  const tz = await getTenantTimezone();
  const { end: asOf } = dateToLocalRange(getTodayStringForTimezone(tz), tz);

  const report = await getInventoryValuationReport(asOf);

  return (
    <ReportLayout activeTab="analisa/nilai-stok" title="Nilai Stok">
      <Suspense fallback={<ReportSkeleton />}>
        <InventoryValuationClient report={report} hideLayout />
      </Suspense>
    </ReportLayout>
  );
}