import { Suspense } from "react";
import { ReportSkeleton } from "../_shared";
import DailyReportClient from "./_components/DailyReportClient";

export default async function DailyReportPage() {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <DailyReportClient />
    </Suspense>
  );
}
