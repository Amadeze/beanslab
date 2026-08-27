import { Suspense } from "react";
import { ReportLayout, ReportSkeleton } from "../../_shared";
import { getSampleReport } from "../../actions";
import { SampleReportClient } from "../../_components/SampleReportClient";
import { getTenantTimezone, requireFeature } from "@/lib/auth";
import { getZonedMonthRange, getCurrentDate } from "@/lib/date-utils";

export default async function SamplePage() {
  await requireFeature("ADVANCED_REPORTS");
  const tz = await getTenantTimezone();
  const now = getCurrentDate();
  const monthRange = getZonedMonthRange(now.getFullYear(), now.getMonth() + 1, tz);

  const report = await getSampleReport(monthRange.start, monthRange.end);

  return (
    <ReportLayout activeTab="analisa/sample" title="Laporan Sample">
      <Suspense fallback={<ReportSkeleton />}>
        <SampleReportClient report={report} />
      </Suspense>
    </ReportLayout>
  );
}