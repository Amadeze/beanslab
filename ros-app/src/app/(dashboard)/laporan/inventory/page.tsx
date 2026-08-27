import { Suspense } from "react";
import { ReportSkeleton } from "../_shared";
import InventoryOverviewClient from "./_components/InventoryOverviewClient";

export default async function InventoryOverviewPage() {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <InventoryOverviewClient />
    </Suspense>
  );
}
