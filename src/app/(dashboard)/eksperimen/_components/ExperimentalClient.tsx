"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FlaskConical, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { StandardDrawer } from "@/components/StandardDrawer";
import { ExperimentalHistoryTable } from "./ExperimentalHistoryTable";
import { ExperimentalForm } from "./ExperimentalForm";
import { PromoteForm } from "./PromoteForm";
import { CompactHeader } from "@/components/layout/CompactHeader";
import { WorkspaceNav } from "@/components/layout/WorkspaceNav";
import type {
  RBStockOption,
  SupplyOption,
  FGProductOption,
  ExperimentalProductionRow,
} from "../actions";

interface ExperimentalClientProps {
  batches: ExperimentalProductionRow[];
  rbOptions: RBStockOption[];
  supplyOptions: SupplyOption[];
  fgOptions: FGProductOption[];
}

export function ExperimentalClient({
  batches,
  rbOptions,
  supplyOptions,
  fgOptions,
}: ExperimentalClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const parentRoastBatchId = searchParams.get("parentRoastBatchId") ?? "";
  const [drawerOpen, setDrawerOpen] = useState(Boolean(parentRoastBatchId));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [promoteBatch, setPromoteBatch] = useState<ExperimentalProductionRow | null>(null);

  const canProduce = rbOptions.length > 0 || supplyOptions.length > 0;

  const kpi = useMemo(() => {
    const validBatches = batches.filter((b) => b.status === "COMPLETED");
    const totalInput = validBatches.reduce((sum, b) => sum + b.inputKg, 0);
    const totalOutput = validBatches.reduce((sum, b) => sum + b.outputKg, 0);
    return { count: batches.length, totalInput, totalOutput };
  }, [batches]);

  const headerSignal = useMemo(() => {
    return canProduce
      ? { label: "Sinyal", value: "Siap eksperimen", tone: "ready" as const }
      : { label: "Sinyal", value: "Input belum siap", tone: "critical" as const };
  }, [canProduce]);

  const headerMetrics = useMemo(() => {
    return [
      { label: "Batch", value: `${kpi.count} tercatat` },
      { label: "Input", value: `${kpi.totalInput.toFixed(1)} kg` },
      { label: "Output", value: `${kpi.totalOutput.toFixed(1)} kg` },
    ];
  }, [kpi]);

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <CompactHeader
          title="Eksperimen"
          description="Produksi bebas tanpa template resep. Hasil tetap terpantau di inventaris."
          stage="production"
          signal={headerSignal}
          metrics={headerMetrics}
          next={{ label: "Lanjut ke Produksi", href: "/produksi" }}
          actions={
            <Button
              size="default"
              variant="default"
              className="gap-2 px-5"
              onClick={() => setDrawerOpen(true)}
            >
              <FlaskConical size={16} />
              Batch Baru
            </Button>
          }
          mobileActions={
            <Button
              size="sm"
              variant="default"
              className="gap-1.5 px-3"
              onClick={() => setDrawerOpen(true)}
            >
              <FlaskConical size={14} />
              Batch Baru
            </Button>
          }
        />

        <div className="custom-scrollbar flex-1 overflow-auto">
          <WorkspaceNav kind="roastery" />

          <div className="mx-auto max-w-[1600px] px-4 md:px-6 lg:px-8 pb-8">
            <GlassPanel padding="md">
              <ExperimentalHistoryTable
                batches={batches}
                onPromote={(batch) => setPromoteBatch(batch)}
              />
            </GlassPanel>
          </div>
        </div>
      </div>

      <StandardDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          if (!isSubmitting) setDrawerOpen(open);
        }}
        title="Produksi Eksperimental"
        description="Tanpa template resep. Pilih bahan, catat hasil, dan lacak di inventaris."
        size="lg"
        submitButton={
          <Button
            type="submit"
            form="experimental-form"
            size="sm"
            disabled={isSubmitting || !canProduce}
            className="gap-1.5 rounded-[8px] font-bold shadow-md disabled:opacity-60"
          >
            {isSubmitting && <Loader2 size={13} className="animate-spin" />}
            {isSubmitting ? "Menyimpan..." : "Simpan Batch"}
          </Button>
        }
      >
        {!canProduce ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-200 py-12 text-center">
            <FlaskConical size={24} className="text-zinc-300" />
            <p className="text-sm font-medium text-zinc-500">
              Bahan belum tersedia
            </p>
            <p className="text-xs text-zinc-400 max-w-xs">
              Tambahkan Roasted Bean, Green Bean, atau Persediaan Non-Kopi terlebih dahulu.
            </p>
          </div>
        ) : (
          <ExperimentalForm
            id="experimental-form"
            rbOptions={rbOptions}
            supplyOptions={supplyOptions}
            fgOptions={fgOptions}
            parentRoastBatchId={parentRoastBatchId}
            onSuccess={() => {
              setDrawerOpen(false);
              router.refresh();
            }}
            onPendingChange={setIsSubmitting}
          />
        )}
      </StandardDrawer>

      <StandardDrawer
        open={!!promoteBatch}
        onOpenChange={(open) => {
          if (!open && !isSubmitting) setPromoteBatch(null);
        }}
        title="Jadikan Produk Katalog"
        description="Lengkapi detail produk agar dapat dijual/dilihat di katalog."
        size="lg"
        submitButton={
          <Button
            type="submit"
            form="promote-form"
            size="sm"
            disabled={isSubmitting}
            className="gap-1.5 rounded-[8px] font-bold shadow-md disabled:opacity-60"
          >
            {isSubmitting && <Loader2 size={13} className="animate-spin" />}
            {isSubmitting ? "Menyimpan..." : "Promosikan"}
          </Button>
        }
      >
        {promoteBatch && (
          <PromoteForm
            batch={promoteBatch}
            supplyOptions={supplyOptions}
            onSuccess={() => {
              setPromoteBatch(null);
              router.refresh();
            }}
            onCancel={() => setPromoteBatch(null)}
          />
        )}
      </StandardDrawer>
    </>
  );
}
