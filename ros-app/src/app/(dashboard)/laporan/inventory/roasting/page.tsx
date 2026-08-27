import { Suspense } from "react";
import { ReportSkeleton } from "../../_shared";
import RoastingReportClient from "./_components/RoastingReportClient";

export default async function RoastingReportPage() {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <RoastingReportClient />
    </Suspense>
  );
}
