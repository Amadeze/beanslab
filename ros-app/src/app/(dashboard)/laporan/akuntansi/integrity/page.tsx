import { Suspense } from "react";
import { ReportLayout } from "../../_shared/ReportLayout";
import { requireFeature } from "@/lib/auth";
import { getGlIntegrityCheck } from "../actions";
import { IntegrityClient } from "./IntegrityClient";

export default async function IntegrityPage() {
  await requireFeature("ADVANCED_REPORTS");
  const issues = await getGlIntegrityCheck().catch(() => []);

  return (
    <ReportLayout activeTab="akuntansi/integrity">
      <Suspense fallback={<div className="p-8 text-sm text-slate-400">Memeriksa...</div>}>
        <IntegrityClient issues={issues} />
      </Suspense>
    </ReportLayout>
  );
}
