import { Suspense } from "react";
import { ReportSkeleton } from "../../_shared";
import StockReportClient from "./_components/StockReportClient";

export default async function StockReportPage() {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <StockReportClient />
    </Suspense>
  );
}
