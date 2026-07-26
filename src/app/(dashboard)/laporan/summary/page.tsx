import { Suspense } from "react";
import { ReportSkeleton } from "../_shared";
import SummaryReportClient from "./_components/SummaryReportClient";

export default async function SummaryReportPage() {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <SummaryReportClient />
    </Suspense>
  );
}
