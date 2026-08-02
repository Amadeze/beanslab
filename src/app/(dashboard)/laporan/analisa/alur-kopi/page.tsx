import { Suspense } from "react";
import { ReportLayout, ReportSkeleton } from "../../_shared";
import { CoffeeFlowClient } from "../../_components/CoffeeFlowClient";
import { getCoffeeFlowReport } from "../../actions";
import { getTenantTimezone, requireFeature } from "@/lib/auth";
import { getZonedMonthRange, getCurrentDate } from "@/lib/date-utils";

export default async function AlurKopiPage() {
  await requireFeature("ADVANCED_REPORTS");
  const tz = await getTenantTimezone();
  const now = getCurrentDate();
  const monthRange = getZonedMonthRange(now.getFullYear(), now.getMonth() + 1, tz);

  const report = await getCoffeeFlowReport(monthRange.start, monthRange.end);

  return (
    <ReportLayout activeTab="analisa/alur-kopi" title="Alur Kopi">
      <Suspense fallback={<ReportSkeleton />}>
        <CoffeeFlowClient report={report} />
      </Suspense>
    </ReportLayout>
  );
}