import { Badge } from "@/components/ui/badge";
import type { DisplayStatus } from "@/lib/inventory-utils";

export type { DisplayStatus };

const STATUS_CONFIG: Record<DisplayStatus, { label: string; className: string }> = {
  aman: {
    label: "Aman",
    className: "bg-[var(--status-success)]/10 text-[var(--status-success)] border-[var(--status-success)]/30",
  },
  rendah: {
    label: "Menipis",
    className: "bg-[var(--status-warning)]/10 text-[var(--status-warning)] border-[var(--status-warning)]/30",
  },
  habis: {
    label: "Habis",
    className: "bg-[var(--status-danger)]/10 text-[var(--status-danger)] border-[var(--status-danger)]/30",
  },
  belum_dikonfigurasi: {
    label: "Belum Diatur",
    className: "bg-surface-sunken text-ink-tertiary border-border",
  },
};

export function InventoryStatusBadge({ status }: { status: DisplayStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={`text-[11px] font-medium ${config.className}`}>
      {config.label}
    </Badge>
  );
}
