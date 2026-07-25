"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Flame, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { StandardDrawer } from "@/components/StandardDrawer";
import { RoastingHistoryTable } from "./RoastingHistoryTable";
import { RoastingForm } from "./RoastingForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { WorkspaceNav } from "@/components/layout/WorkspaceNav";
import { OperatingHero } from "@/components/layout/OperatingHero";
import { RoastsClient } from "../roasts/_components/RoastsClient";
import type {
  GBStockOption,
  RBProductOption,
  ParentRoastingBatchRow,
  MachineOption,
  RoastProfileRow,
} from "../actions";

interface RoastingClientProps {
  activeTab: "batches" | "profiles";
  batches: ParentRoastingBatchRow[];
  gbOptions: GBStockOption[];
  rbOptions: RBProductOption[];
  machineOptions: MachineOption[];
  roastProfiles: RoastProfileRow[];
}

export function RoastingClient({
  activeTab,
  batches,
  gbOptions,
  rbOptions,
  machineOptions,
  roastProfiles,
}: RoastingClientProps) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const kpi = useMemo(() => {
    const validBatches = batches.filter((b) => b.status === "COMPLETED");
    const totalGB = validBatches.reduce((sum, b) => sum + b.targetWeightKg, 0);
    const totalRB = validBatches.reduce(
      (sum, b) => sum + (b.actualOutputKg ?? 0),
      0,
    );
    const avgLoss = totalGB > 0 ? ((totalGB - totalRB) / totalGB) * 100 : 0;

    return { count: batches.length, totalGB, totalRB, avgLoss };
  }, [batches]);

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader
          title="Roasting"
          description="Batch roasting, profil hasil Artisan, dan produksi lanjutan berada dalam satu konteks kerja."
          stage="roasting"
          actions={
            activeTab === "batches" ? (
              <Button
                size="default"
                variant="default"
                className="gap-2 px-5"
                onClick={() => setDrawerOpen(true)}
              >
                <Flame size={16} />
                Mulai Roasting
              </Button>
            ) : null
          }
          mobileActions={
            activeTab === "batches" ? (
              <Button
                size="sm"
                variant="default"
                className="gap-1.5 px-3"
                onClick={() => setDrawerOpen(true)}
              >
                <Flame size={14} />
                Mulai Roasting
              </Button>
            ) : null
          }
        />

        <div className="custom-scrollbar flex-1 overflow-auto">
          <OperatingHero
            stage="roasting"
            headline={
              activeTab === "batches"
                ? `${gbOptions.length} bahan siap masuk panas.`
                : `${roastProfiles.length} profil menyimpan jejak rasa.`
            }
            description={
              activeTab === "batches"
                ? "Pilih bahan dan mesin, catat hasil aktual, lalu teruskan output ke produksi."
                : "Cari profil, bandingkan kurva, dan hubungkan hasil Artisan ke batch produksi."
            }
            signalValue={
              activeTab === "batches"
                ? gbOptions.length > 0 && machineOptions.length > 0
                  ? "Siap roasting"
                  : "Input belum siap"
                : `${roastProfiles.length} profil`
            }
            signalTone={
              activeTab === "batches"
                ? gbOptions.length > 0 && machineOptions.length > 0
                  ? "ready"
                  : "critical"
                : "neutral"
            }
            metrics={[
              { label: "Green bean", value: `${gbOptions.length} pilihan` },
              { label: "Mesin aktif", value: `${machineOptions.length} unit` },
              { label: "RB dihasilkan", value: `${kpi.totalRB.toFixed(1)} kg` },
              { label: "Rata-rata loss", value: `${kpi.avgLoss.toFixed(1)}%` },
            ]}
            next={{ label: "Lanjut ke Produksi", href: "/produksi" }}
          />
          {activeTab === "batches" ? (
            <>
              <WorkspaceNav kind="roastery" />

              <div className="mx-auto max-w-[1600px] px-4 pb-8 md:px-6 lg:px-8">
                <GlassPanel padding="md">
                  <RoastingHistoryTable
                    batches={batches}
                    machineOptions={machineOptions}
                  />
                </GlassPanel>
              </div>
            </>
          ) : (
            <>
              <WorkspaceNav kind="roastery" />
              <div className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8">
                <RoastsClient roasts={roastProfiles} />
              </div>
            </>
          )}
        </div>
      </div>

      <StandardDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          if (!isSubmitting) setDrawerOpen(open);
        }}
        title="Catat Roasting Batch"
        description="Stok Green Bean akan dipotong dan Roasted Bean bertambah otomatis."
        size="lg"
        submitButton={
          <Button
            type="submit"
            form="roasting-form"
            size="sm"
            disabled={isSubmitting || gbOptions.length === 0}
            className="gap-1.5 rounded-[8px] font-bold shadow-md disabled:opacity-60"
          >
            {isSubmitting && <Loader2 size={13} className="animate-spin" />}
            {isSubmitting ? "Menyimpan..." : "Simpan Batch"}
          </Button>
        }
      >
        {gbOptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-200 py-12">
            <Plus size={24} className="text-zinc-300" />
            <p className="text-sm font-medium text-zinc-500">
              Tidak ada Green Bean tersedia
            </p>
            <p className="text-xs text-zinc-400">
              Catat Barang Datang di halaman Inventory terlebih dahulu.
            </p>
          </div>
        ) : (
          <RoastingForm
            id="roasting-form"
            gbOptions={gbOptions}
            rbOptions={rbOptions}
            machineOptions={machineOptions}
            batches={batches}
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
