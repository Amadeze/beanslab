"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Factory, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { StandardDrawer } from "@/components/StandardDrawer";
import { ProductionHistoryTable } from "./ProductionHistoryTable";
import { ProductionForm } from "./ProductionForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { WorkspaceNav } from "@/components/layout/WorkspaceNav";
import { OperatingHero } from "@/components/layout/OperatingHero";
import type {
  FGProductOption,
  PackagingOption,
  ProductionBatchRow,
  RBStockOption,
} from "../actions";

interface ProductionClientProps {
  batches: ProductionBatchRow[];
  fgOptions: FGProductOption[];
  rbOptions: RBStockOption[];
  packagingOptions: PackagingOption[];
}

export function ProductionClient({
  batches,
  fgOptions,
  rbOptions,
  packagingOptions,
}: ProductionClientProps) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canProduce = rbOptions.length > 0 && packagingOptions.length > 0;

  const kpi = useMemo(() => {
    const validBatches = batches.filter((b) => b.status === "COMPLETED");
    const totalFG = validBatches.reduce((sum, b) => sum + b.unitsProduced, 0);
    const totalRB = validBatches.reduce((sum, b) => sum + b.totalRbUsedKg, 0);

    return { count: batches.length, totalFG, totalRB };
  }, [batches]);

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader
          title="Produksi & Packing"
          description={`${batches.length} batch tercatat`}
          stage="production"
          actions={
            <Button
              size="default"
              variant="default"
              className="gap-2 px-5"
              onClick={() => setDrawerOpen(true)}
            >
              <Factory size={16} />
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
              <Factory size={14} />
              Batch Baru
            </Button>
          }
        />

        <div className="custom-scrollbar flex-1 overflow-auto">
          <OperatingHero
            stage="production"
            headline={`${fgOptions.length} SKU siap dirakit menjadi produk jual.`}
            description="Pilih SKU, pastikan bahan tersedia, lalu catat hasil packing."
            signalValue={canProduce ? "Siap produksi" : "Belum siap"}
            signalTone={canProduce ? "ready" : "critical"}
            metrics={[
              { label: "Roasted bean", value: `${rbOptions.length} pilihan` },
              { label: "Kemasan", value: `${packagingOptions.length} pilihan` },
              { label: "Output tercatat", value: `${kpi.totalFG} pcs` },
              { label: "RB terpakai", value: `${kpi.totalRB.toFixed(1)} kg` },
            ]}
            next={{ label: "Lanjut ke Penjualan", href: "/penjualan" }}
          />
          <WorkspaceNav kind="roastery" />

          <div className="mx-auto max-w-[1600px] px-4 md:px-6 lg:px-8 pb-8">
            <GlassPanel padding="md">
              <ProductionHistoryTable batches={batches} />
            </GlassPanel>
          </div>
        </div>
      </div>

      <StandardDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          if (!isSubmitting) setDrawerOpen(open);
        }}
        title="Batch Produksi Baru"
        description="Pilih SKU → resep otomatis terisi. Gramasi dapat diedit bebas sebelum disimpan."
        size="lg"
        submitButton={
          <Button
            type="submit"
            form="production-form"
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
            <Factory size={24} className="text-zinc-300" />
            <p className="text-sm font-medium text-zinc-500">
              Bahan baku belum tersedia
            </p>
            <p className="text-xs text-zinc-400 max-w-xs">
              {rbOptions.length === 0 && "Roasted Bean stok kosong. "}
              {packagingOptions.length === 0 && "Kemasan stok kosong. "}
              Tambahkan melalui Pasokan dan Roasting terlebih dahulu.
            </p>
          </div>
        ) : (
          <ProductionForm
            id="production-form"
            fgOptions={fgOptions}
            rbOptions={rbOptions}
            packagingOptions={packagingOptions}
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
