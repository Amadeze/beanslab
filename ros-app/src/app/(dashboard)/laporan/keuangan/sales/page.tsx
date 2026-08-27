import { Suspense } from "react";
import { ReportSkeleton } from "../../_shared";
import SalesReportClient from "./_components/SalesReportClient";

export default async function SalesReportPage() {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <SalesReportClient />
    </Suspense>
  );
}
