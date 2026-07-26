import { Suspense } from "react";
import { ReportSkeleton } from "../_shared";
import AnalysisReportClient from "./_components/AnalysisReportClient";

export default async function AnalysisReportPage() {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <AnalysisReportClient />
    </Suspense>
  );
}
