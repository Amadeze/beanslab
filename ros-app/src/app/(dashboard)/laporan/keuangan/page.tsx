import { Suspense } from "react";
import { ReportSkeleton } from "../_shared";
import KeuanganOverviewClient from "./_components/KeuanganOverviewClient";

export default async function KeuanganOverviewPage() {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <KeuanganOverviewClient />
    </Suspense>
  );
}
