"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Coffee, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StandardDrawer } from "@/components/StandardDrawer";
import { GrindingHistoryTable } from "./GrindingHistoryTable";
import { GrindingForm } from "./GrindingForm";
import { CompactHeader } from "@/components/layout/CompactHeader";
import { WorkspaceNav } from "@/components/layout/WorkspaceNav";
import type { InventoryLocationOption } from "@/lib/storage-location";
import type {
  RBStockOption,
  GroundCoffeeOption,
  GrindingBatchRow,
  GrinderOption,
} from "../actions";

interface GrindingClientProps {
  batches: GrindingBatchRow[];
  rbOptions: RBStockOption[];
  groundCoffeeOptions: GroundCoffeeOption[];
  grinderOptions: GrinderOption[];
  locationOptions: InventoryLocationOption[];
}

export function GrindingClient({
  batches,
  rbOptions,
  groundCoffeeOptions,
  grinderOptions,
  locationOptions,
}: GrindingClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSourceProductId = searchParams.get("sourceProductId") ?? "";
  const parentRoastBatchId = searchParams.get("parentRoastBatchId") ?? "";
  const [drawerOpen, setDrawerOpen] = useState(Boolean(requestedSourceProductId));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canGrind = rbOptions.length > 0 && groundCoffeeOptions.length > 0;

  const kpi = useMemo(() => {
    const validBatches = batches.filter((b) => b.status === "COMPLETED");
    const totalInput = validBatches.reduce((sum, b) => sum + b.inputKg, 0);
    const totalOutput = validBatches.reduce((sum, b) => sum + b.outputKg, 0);
    const totalLoss = validBatches.reduce((sum, b) => sum + b.lossKg, 0);

    return { count: batches.length, totalInput, totalOutput, totalLoss };
  }, [batches]);

  const headerSignal = useMemo(() => {
    return canGrind
      ? { label: "Sinyal", value: "Siap giling", tone: "ready" as const }
      : { label: "Sinyal", value: "Input belum siap", tone: "critical" as const };
  }, [canGrind]);

  const headerMetrics = useMemo(() => {
    return [
      { label: "RB", value: `${rbOptions.length} pilihan` },
      { label: "Output", value: `${groundCoffeeOptions.length} pilihan` },
      { label: "Hasil", value: `${kpi.totalOutput.toFixed(1)} kg` },
      { label: "Susut", value: `${kpi.totalLoss.toFixed(2)} kg` },
    ];
  }, [rbOptions.length, groundCoffeeOptions.length, kpi]);

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <CompactHeader
          title="Penggilingan"
          description={`${batches.length} batch tercatat`}
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
              <Coffee size={16} />
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
              <Coffee size={14} />
              Batch Baru
            </Button>
          }
        />

        <div className="custom-scrollbar flex-1 overflow-auto">
          <WorkspaceNav kind="roastery" />

          <div className="mx-auto max-w-[1600px] px-4 md:px-6 lg:px-8 pb-8">
            <Card className="p-5">
              <GrindingHistoryTable batches={batches} />
            </Card>
          </div>
        </div>
      </div>

      <StandardDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          if (!isSubmitting) setDrawerOpen(open);
        }}
        title="Batch Penggilingan Baru"
        description="Pilih Roasted Bean → pilih ukuran giling → catat hasil."
        size="lg"
        submitButton={
          <Button
            type="submit"
            form="grinding-form"
            size="sm"
            disabled={isSubmitting || !canGrind}
            className="gap-1.5 rounded-[8px] font-bold shadow-md disabled:opacity-60"
          >
            {isSubmitting && <Loader2 size={13} className="animate-spin" />}
            {isSubmitting ? "Menyimpan..." : "Simpan Batch"}
          </Button>
        }
      >
        {!canGrind ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-200 py-12 text-center">
            <Coffee size={24} className="text-zinc-300" />
            <p className="text-sm font-medium text-zinc-500">
              Bahan belum tersedia
            </p>
            <p className="text-xs text-zinc-400 max-w-xs">
              {rbOptions.length === 0 && "Roasted Bean stok kosong. "}
              {groundCoffeeOptions.length === 0 && "Belum ada SKU kopi giling (kg). "}
              Tambahkan SKU Roasted Bean khusus untuk kopi giling di Master Data.
            </p>
          </div>
        ) : (
          <GrindingForm
            id="grinding-form"
            rbOptions={rbOptions}
            groundCoffeeOptions={groundCoffeeOptions}
            grinderOptions={grinderOptions}
            locationOptions={locationOptions}
            initialSourceProductId={requestedSourceProductId}
            parentRoastBatchId={parentRoastBatchId}
            onSuccess={() => {
              setDrawerOpen(false);
              router.refresh();
            }}
            onPendingChange={setIsSubmitting}
          />
        )}
      </StandardDrawer>
    </>
  );
}
