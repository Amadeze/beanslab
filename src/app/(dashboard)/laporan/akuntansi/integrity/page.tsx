import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { getGlIntegrityCheck } from "../actions";
import { IntegrityClient } from "./IntegrityClient";

export default async function IntegrityPage() {
  const issues = await getGlIntegrityCheck().catch(() => []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integritas GL"
        description="Pemeriksaan otomatis keseimbangan dan konsistensi data akuntansi"
      />
      <Suspense fallback={<div className="p-8 text-sm text-slate-400">Memeriksa...</div>}>
        <IntegrityClient issues={issues} />
      </Suspense>
    </div>
  );
}
