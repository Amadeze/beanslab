import type { LotOperationalStatus } from "@/lib/lot";
import { WORKFLOW_TONE_CLASSES, type WorkflowTone } from "@/lib/workflow";

/**
 * Canonical label + tone for a lot's operational status. Single source so the
 * lot registry (`/inventory/lots`) and the stock breakdown (`StockTable`) show
 * the same vocabulary instead of two diverging ones.
 */
export const LOT_STATUS_META: Record<LotOperationalStatus, { label: string; tone: WorkflowTone }> = {
  ok: { label: "OK", tone: "success" },
  expiring_soon: { label: "Review Segera", tone: "warning" },
  expired: { label: "Perlu Review", tone: "critical" },
  consumed: { label: "Habis", tone: "neutral" },
};

export function lotStatusClasses(status: LotOperationalStatus): string {
  return WORKFLOW_TONE_CLASSES[LOT_STATUS_META[status].tone];
}
