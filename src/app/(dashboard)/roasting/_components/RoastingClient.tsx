"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Flame, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/state";
import { StandardDrawer } from "@/components/StandardDrawer";
import { RoastingHistoryTable } from "./RoastingHistoryTable";
import { RoastingForm } from "./RoastingForm";
import { CompactHeader } from "@/components/layout/CompactHeader";
import { WorkspaceNav } from "@/components/layout/WorkspaceNav";
import { RoastsClient } from "../roasts/_components/RoastsClient";
import type {
  GBStockOption,
  RBProductOption,
  ParentRoastingBatchRow,
  MachineOption,
  RoastProfileRow,
  ReusableRoastProfileRow,
  RoastingLocationOption,
} from "../actions";

interface RoastingClientProps {
  activeTab: "batches" | "profiles";
  batches: ParentRoastingBatchRow[];
  gbOptions: GBStockOption[];
  rbOptions: RBProductOption[];
  machineOptions: MachineOption[];
  roastProfiles: RoastProfileRow[];
  reusableProfiles: ReusableRoastProfileRow[];
  locationOptions: RoastingLocationOption[];
}

export function RoastingClient({
  activeTab,
  batches,
  gbOptions,
  rbOptions,
  machineOptions,
  roastProfiles,
  reusableProfiles,
  locationOptions,
}: RoastingClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedOutputProductId = searchParams.get("productId") ?? "";
  const requestedOutput = rbOptions.find((product) => product.id === requestedOutputProductId);
  const requestedGbId = searchParams.get("gb") ?? "";
  const requestedLotId = searchParams.get("lotId") ?? "";
  const requestedTargetKg = Number(searchParams.get("targetKg") ?? 0);
  const [drawerOpen, setDrawerOpen] = useState(
    (searchParams.get("mulai") === "1" || Boolean(requestedOutput)) && activeTab === "batches",
  );
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

  // ΓöÇΓöÇ Compact header signal ΓöÇΓöÇ
  const headerSignal = useMemo(() => {
    if (activeTab === "batches") {
      return gbOptions.length > 0 && machineOptions.length > 0
        ? { label: "Sinyal", value: "Siap roasting", tone: "ready" as const }
        : { label: "Sinyal", value: "Input belum siap", tone: "critical" as const };
    }
    return { label: "Profil", value: `${roastProfiles.length} profil`, tone: "neutral" as const };
  }, [activeTab, gbOptions.length, machineOptions.length, roastProfiles.length]);

  const headerMetrics = useMemo(() => {
    if (activeTab === "batches") {
      return [
        { label: "GB", value: `${gbOptions.length} pilihan` },
        { label: "Mesin", value: `${machineOptions.length} unit` },
        { label: "RB", value: `${kpi.totalRB.toFixed(1)} kg` },
        { label: "Loss", value: `${kpi.avgLoss.toFixed(1)}%` },
      ];
    }
    return [{ label: "Profil", value: roastProfiles.length }];
  }, [activeTab, gbOptions.length, machineOptions.length, kpi, roastProfiles.length]);

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <CompactHeader
          title="Roasting"
          description="Batch roasting, profil hasil Artisan, dan produksi lanjutan berada dalam satu konteks kerja."
          stage="roasting"
          signal={headerSignal}
          metrics={headerMetrics}
          next={{ label: "Lanjut ke Produksi", href: "/produksi" }}
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
          {activeTab === "batches" ? (
            <>
              <WorkspaceNav kind="roastery" />

              <div className="mx-auto max-w-[1600px] px-4 pb-8 md:px-6 lg:px-8">
                <Card className="p-5 sm:p-6">
                  <RoastingHistoryTable
                    batches={batches}
                    machineOptions={machineOptions}
                    locationOptions={locationOptions}
                    onStartRoasting={() => setDrawerOpen(true)}
                  />
                </Card>
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
        description="Green Bean dipindahkan ke Roasting WIP; stok kanonis berkurang saat batch selesai."
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
          <EmptyState
            icon={<Plus size={18} />}
            title="Tidak ada Green Bean tersedia"
            description="Catat Barang Datang di halaman Inventory terlebih dahulu."
            action={
              <Link
                href="/inventory?view=receiving"
                className="inline-flex h-9 items-center gap-2 rounded-card bg-[var(--chrome-panel)] px-4 text-xs font-bold text-white transition hover:bg-[var(--chrome-accent)]"
              >
                Catat Barang Datang ΓåÆ
              </Link>
            }
          />
        ) : (
          <RoastingForm
            id="roasting-form"
            gbOptions={gbOptions}
            rbOptions={rbOptions}
            machineOptions={machineOptions}
            batches={batches}
            reusableProfiles={reusableProfiles}
            locationOptions={locationOptions}
            initialInputProductId={requestedGbId || requestedOutput?.sourceGreenBeanId || ""}
            initialRoastLevel={requestedOutput?.roastLevel ?? ""}
            initialTargetWeightKg={Number.isFinite(requestedTargetKg) && requestedTargetKg > 0 ? requestedTargetKg : 0}
            prefillLotId={requestedLotId}
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

