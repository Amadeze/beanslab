import { Suspense } from "react";
import { ReportSkeleton } from "../../_shared";
import ProductionReportClient from "./_components/ProductionReportClient";

export default async function ProductionReportPage() {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <ProductionReportClient />
    </Suspense>
  );
}
