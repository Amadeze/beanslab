"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/PageHeader";

interface SpeedDialItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: "primary" | "secondary";
}

interface MobileFabAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  "aria-label"?: string;
}

interface StandardPageLayoutProps {
  title: string;
  description?: string;
  actionButton?: React.ReactNode;
  mobileFabAction?: MobileFabAction;
  mobileSpeedDialItems?: SpeedDialItem[];
  mobileHeaderActions?: React.ReactNode;
  children: React.ReactNode;
  isLoading?: boolean;
  stage?: "inventory" | "roasting" | "production" | "sales" | "finance";
}

export function StandardPageLayout({
  title,
  description,
  actionButton,
  mobileFabAction,
  mobileSpeedDialItems,
  mobileHeaderActions,
  children,
  isLoading = false,
  stage,
}: StandardPageLayoutProps) {
  const [speedDialOpen, setSpeedDialOpen] = useState(false);
  const fabRef = useRef<HTMLButtonElement>(null);
  const speedDialRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const closeSpeedDial = useCallback(() => {
    setSpeedDialOpen(false);
    requestAnimationFrame(() => fabRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!speedDialOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSpeedDial();
    };
    const onPointerDown = (event: MouseEvent) => {
      if (
        speedDialRef.current &&
        !speedDialRef.current.contains(event.target as Node) &&
        fabRef.current &&
        !fabRef.current.contains(event.target as Node)
      ) {
        closeSpeedDial();
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [speedDialOpen, closeSpeedDial]);

  const hasSpeedDial = !isLoading && !!mobileSpeedDialItems?.length;
  const hasSingleAction = !isLoading && !hasSpeedDial && !!mobileFabAction;
  const hasMobileAction = hasSpeedDial || hasSingleAction;

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden bg-transparent">
      <PageHeader
        title={title}
        description={description}
        actions={actionButton}
        mobileActions={mobileHeaderActions}
        stage={stage}
      />

      {hasSpeedDial && (
        <>
          {speedDialOpen && <button type="button" className="fixed inset-0 z-[99] bg-stone-950/25 md:hidden" onClick={closeSpeedDial} aria-label="Tutup menu aksi" />}
          <div ref={speedDialRef} className="fixed bottom-[calc(88px+env(safe-area-inset-bottom,0px))] right-4 z-[100] flex flex-col items-end md:bottom-5">
            {speedDialOpen && (
              <div id={panelId} role="menu" aria-label="Menu aksi" className="mb-2 flex flex-col items-end gap-2">
                {mobileSpeedDialItems?.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      item.onClick();
                      closeSpeedDial();
                    }}
                    className={cn(
                      "flex min-h-11 items-center gap-2.5 rounded-[10px] border px-4 py-2.5 text-sm font-semibold shadow-lg",
                      item.variant === "primary"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-white/10 bg-[#0B141B] text-white",
                    )}
                  >
                    {item.icon}<span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
            <button
              ref={fabRef}
              type="button"
              onClick={() => setSpeedDialOpen((open) => !open)}
              className="flex min-h-12 items-center gap-2 rounded-[11px] border border-primary/45 bg-[#080B0C] px-4 py-3 text-sm font-semibold text-[#F0AC8C] shadow-[0_16px_36px_rgba(5,9,13,.38)]"
              aria-label={speedDialOpen ? "Tutup menu aksi" : "Buka menu aksi"}
              aria-expanded={speedDialOpen}
              aria-controls={panelId}
            >
              {speedDialOpen ? <X size={19} /> : <Plus size={19} />}
              {speedDialOpen ? "Tutup" : "Aksi"}
            </button>
          </div>
        </>
      )}

      {hasSingleAction && (
        <button
          type="button"
          onClick={mobileFabAction?.onClick}
          className="fixed bottom-[calc(88px+env(safe-area-inset-bottom,0px))] right-4 z-[100] flex min-h-12 items-center gap-2 rounded-[11px] border border-primary bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-[0_16px_36px_rgba(5,9,13,.3)] md:bottom-5"
          aria-label={mobileFabAction?.["aria-label"] || mobileFabAction?.label}
        >
          {mobileFabAction?.icon || <Plus size={19} />}
          <span>{mobileFabAction?.label}</span>
        </button>
      )}

      <div className={cn("custom-scrollbar relative min-w-0 flex-1 overflow-y-auto overflow-x-hidden", hasMobileAction && "pb-[calc(80px+env(safe-area-inset-bottom,0px))] md:pb-0")}>
        <div className="mx-auto min-w-0 w-full max-w-[1600px] p-4 sm:p-5 md:p-6 lg:p-7">
          {isLoading ? <PageSkeleton /> : children}
        </div>
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 rounded-[12px] border border-border bg-card px-4 py-3">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="ml-auto h-4 w-24" />
        <Skeleton className="h-4 w-20" />
      </div>
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-center gap-4 rounded-[12px] border border-border bg-card px-4 py-3.5">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="ml-auto h-4 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}
