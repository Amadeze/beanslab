import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { getProductionBatchRecap } from "../../actions";
import { ProductionBatchRecap } from "./_components/ProductionBatchRecap";

export const dynamic = "force-dynamic";

export default async function ProductionBatchRecapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getProductionBatchRecap(id);
  if (!data) notFound();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={`Rekap Batch ${data.code}`}
        eyebrow="Produksi"
        description={`${data.totalRbUsedKg.toFixed(3)} kg bahan kopi → ${data.unitsProduced} unit ${data.outputProduct.name}`}
        stage="production"
        actions={
          <Link
            href="/produksi"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/20 px-3 text-xs font-bold text-white transition hover:bg-card/10"
          >
            <ArrowLeft size={14} /> Kembali
          </Link>
        }
      />
      <div className="custom-scrollbar flex-1 overflow-auto">
        <div className="mx-auto max-w-[1400px] p-4 md:p-6 lg:p-8">
          <ProductionBatchRecap data={data} />
        </div>
      </div>
    </div>
  );
}
