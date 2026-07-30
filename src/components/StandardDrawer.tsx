import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface StandardDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  submitButton?: React.ReactNode;
  showFooter?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  isLoading?: boolean;
}

const SIZE_MAP: Record<NonNullable<StandardDrawerProps["size"]>, string> = {
  sm: "sm:max-w-[400px]",
  md: "sm:max-w-[520px]",
  lg: "sm:max-w-[720px]",
  xl: "sm:max-w-[960px]",
};

export function StandardDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  submitButton,
  showFooter = true,
  size = "md",
  isLoading = false,
}: StandardDrawerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={[
          SIZE_MAP[size],
          "flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[calc(100dvh-3rem)]",
          "rounded-[14px] border border-border bg-card shadow-[0_32px_100px_rgba(5,9,13,.38)]",
        ].join(" ")}
      >
        {/* ── Modal Header ── */}
        <DialogHeader className="instrument-grid-dark flex shrink-0 flex-row items-start justify-between gap-4 border-b border-white/10 bg-[#0B141B] px-5 py-4 sm:px-6">
          <div className="min-w-0 pt-0.5 text-left">
            <DialogTitle className="truncate font-heading text-lg font-bold tracking-[-0.035em] text-white sm:text-xl">
              {title}
            </DialogTitle>
            {description && (
              <DialogDescription className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-white/52">
                {description}
              </DialogDescription>
            )}
          </div>

          <DialogClose
            render={
              <button
                className="mt-0.5 flex shrink-0 items-center justify-center rounded-[8px] border border-white/12 bg-white/[0.06] p-2 text-white/55 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none"
                aria-label="Tutup"
              />
            }
          >
            <X size={14} strokeWidth={3} />
          </DialogClose>
        </DialogHeader>

        {/* ── Modal Body — scrollable ── */}
        <div className="flex-1 overflow-y-auto px-5 py-5 custom-scrollbar sm:px-6 sm:py-6">
          {isLoading ? <FormSkeleton /> : children}
        </div>

        {/* ── Modal Footer ── */}
        {showFooter && <div className="shrink-0 border-t border-border bg-muted/55 px-5 py-4 sm:px-6">
          <DialogFooter className="flex-row justify-end gap-3 sm:justify-end bg-transparent border-none p-0">
            <DialogClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-[8px] border-border bg-card px-5 text-foreground shadow-none hover:bg-muted"
                />
              }
            >
              Batal
            </DialogClose>
            {submitButton && (
              <div className="[&>button]:rounded-[8px] [&>button]:px-6 [&>button]:font-bold [&>button]:shadow-none">
                {submitButton}
              </div>
            )}
          </DialogFooter>
        </div>}
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// Skeleton loading state untuk form di dalam drawer
// ─────────────────────────────────────────────

function FormSkeleton() {
  return (
    <div className="space-y-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
      ))}
      <Separator className="my-2 bg-border" />
      <div className="space-y-1.5">
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-20 w-full rounded-md" />
      </div>
    </div>
  );
}
