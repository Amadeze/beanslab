import { Suspense } from "react";
import { ReportSkeleton } from "../_shared";
import ExpenseReportClient from "./_components/ExpenseReportClient";

export default async function ExpenseReportPage() {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <ExpenseReportClient />
    </Suspense>
  );
}
