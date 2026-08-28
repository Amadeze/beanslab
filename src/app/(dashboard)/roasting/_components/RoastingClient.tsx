"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Flame, Loader2, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/state";
import { StandardDrawer } from "@/components/StandardDrawer";
import { StandardPageLayout } from "@/components/StandardPageLayout";
import { RoastingHistoryTable } from "./RoastingHistoryTable";
import { RoastingForm } from "./RoastingForm";
import { WorkspaceNav } from "@/components/layout/WorkspaceNav";
import { RoastsClient } from "../roasts/_components/RoastsClient";
import { PageHeader } from "@/components/layout/PageHeader";
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
  const requestedTargetKg = Number(searchParams.get("targetKg") ?? 0);
  const [drawerOpen, setDrawerOpen] = useState(
    (searchParams.get("mulai") === "1" || Boolean(requestedOutput)) && activeTab === "batches",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const headerActions = activeTab === "batches" ? [
    {
      label: "Mulai Roasting",
      icon: <Flame size={17} />,
      onClick: () => setDrawerOpen(true),
      variant: "primary" as const,
    },
    {
      label: "Impor Artisan",
      icon: <Upload size={17} />,
      onClick: () => router.push("/roasting?tab=profiles&import=1"),
      variant: "secondary" as const,
    },
  ] : [];

  return (
    <StandardPageLayout
      title="Roasting"
      description="Batch roasting, profil hasil Artisan, dan produksi lanjutan berada dalam satu konteks kerja."
      stage="roasting"
      compact
      showHeader={false}
      mobileFabAction={
        activeTab === "batches" ? {
          label: "Mulai Roasting",
          icon: <Flame size={19} />,
          onClick: () => setDrawerOpen(true),
          "aria-label": "Mulai batch roasting baru",
        } : undefined
      }
      mobileSpeedDialItems={
        activeTab === "batches" ? [
          { label: "Batch Roasting", icon: <Flame size={17} />, onClick: () => setDrawerOpen(true), variant: "primary" },
          { label: "Impor Artisan", icon: <Upload size={17} />, onClick: () => router.push("/roasting?tab=profiles&import=1") },
        ] : undefined
      }
    >
      <PageHeader
        title="Roasting"
        description="Batch roasting, profil hasil Artisan, dan produksi lanjutan berada dalam satu konteks kerja."
        stage="roasting"
        compact
        actions={headerActions}
      />
      <div className="flex flex-col gap-2 md:gap-3">
        <WorkspaceNav kind="roastery" />
        {activeTab === "batches" ? (
          <Card className="overflow-hidden border shadow-elevation-soft">
            <div className="p-2.5 sm:p-3">
              <RoastingHistoryTable
                batches={batches}
                machineOptions={machineOptions}
                locationOptions={locationOptions}
                onStartRoasting={() => setDrawerOpen(true)}
              />
            </div>
          </Card>
        ) : (
          <div className="sm:p-1">
            <RoastsClient roasts={roastProfiles} />
          </div>
        )}
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
                Catat Barang Datang →
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
            initialInputProductId={requestedOutput?.sourceGreenBeanId ?? ""}
            initialRoastLevel={requestedOutput?.roastLevel ?? ""}
            initialTargetWeightKg={Number.isFinite(requestedTargetKg) && requestedTargetKg > 0 ? requestedTargetKg : 0}
            onSuccess={() => {
              setDrawerOpen(false);
              router.refresh();
            }}
            onPendingChange={setIsSubmitting}
          />
        )}
      </StandardDrawer>
    </StandardPageLayout>
  );
}
