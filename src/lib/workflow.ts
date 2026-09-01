import type { OperatorFulfillmentStatus } from "@/lib/fulfillment-status";

export type WorkflowTone = "neutral" | "ready" | "success" | "warning" | "critical" | "info";

export type DomainTone =
  | "sales"
  | "finance"
  | "production"
  | "roasting"
  | "inventory"
  | "warehouse"
  | "neutral";

/**
 * Token-based tone ΓåÆ class map. Mirrors DESIGN_GUIDE status tokens
 * (--status-success / --status-warning / --status-danger / --status-info).
 * Never hardcode hex here.
 */
export const WORKFLOW_TONE_CLASSES: Record<WorkflowTone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  ready: "bg-[var(--status-success)]/10 text-[var(--status-success)] border-[var(--status-success)]/30",
  success: "bg-[var(--status-success)]/10 text-[var(--status-success)] border-[var(--status-success)]/30",
  warning: "bg-[var(--status-warning)]/10 text-[var(--status-warning)] border-[var(--status-warning)]/30",
  critical: "bg-[var(--status-danger)]/10 text-[var(--status-danger)] border-[var(--status-danger)]/30",
  info: "bg-[var(--status-info)]/10 text-[var(--status-info)] border-[var(--status-info)]/30",
};

export const DOMAIN_TONE_CLASSES: Record<DomainTone, string> = {
  sales: "border-domain-sales/25 bg-domain-sales/8 text-domain-sales hover:bg-domain-sales/15",
  finance: "border-domain-finance/25 bg-domain-finance/8 text-domain-finance hover:bg-domain-finance/15",
  production: "border-domain-production/25 bg-domain-production/8 text-domain-production hover:bg-domain-production/15",
  roasting: "border-domain-roasting/25 bg-domain-roasting/8 text-domain-roasting hover:bg-domain-roasting/15",
  inventory: "border-domain-inventory/25 bg-domain-inventory/8 text-domain-inventory hover:bg-domain-inventory/15",
  warehouse: "border-domain-warehouse/25 bg-domain-warehouse/8 text-domain-warehouse hover:bg-domain-warehouse/15",
  neutral: "border-border bg-card text-ink hover:bg-surface-sunken",
};

// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
// INVOICE
// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export type InvoiceStageInput = {
  status: string;
  fulfillmentStatus: OperatorFulfillmentStatus | string;
  salesChannel?: string;
};

export function deriveInvoiceStage(inv: InvoiceStageInput): { label: string; tone: WorkflowTone } {
  const pay = inv.status;
  const ful = inv.fulfillmentStatus;

  if (pay === "DRAFT") return { label: "Draft", tone: "neutral" };
  if (pay === "VOID") return { label: "Void", tone: "neutral" };
  if (pay === "RETURNED") return { label: "Diretur", tone: "critical" };
  if (pay === "ISSUED") return { label: "Tempo", tone: "warning" };
  if (pay === "PARTIAL") return { label: "Sebagian", tone: "info" };

  // pay === PAID
  switch (ful) {
    case "AWAITING_PAYMENT":
    case "NEEDS_PRODUCTION":
      return { label: "Lunas ┬╖ Perlu produksi", tone: "warning" };
    case "READY_TO_PACK":
      return { label: "Lunas ┬╖ Siap kemas", tone: "ready" };
    case "PACKED":
      return { label: "Lunas ┬╖ Dikemas", tone: "info" };
    case "SHIPPED":
      return { label: "Lunas ┬╖ Dikirim", tone: "info" };
    case "DELIVERED":
      return { label: "Selesai", tone: "success" };
    default:
      return { label: "Lunas", tone: "success" };
  }
}

export type InvoiceNextMode = "approve" | "pay" | "fulfill" | "prepare" | null;

export type InvoiceNextAction = {
  label: string;
  mode: InvoiceNextMode;
  tone: DomainTone;
  href?: string;
};

/**
 * Single source of truth for the row's primary action. Fixes the previous
 * dead-end where a PAID invoice that still needed production/roasting had no
 * inline next action.
 */
export function deriveInvoiceNextAction(
  inv: InvoiceStageInput & { balance: number },
): InvoiceNextAction {
  // B2B manual ready-to-pack can be fulfilled even while ISSUED (unpaid) — e.g. credit or cash-on-delivery
  if (
    inv.salesChannel === "B2B_DIRECT" &&
    inv.fulfillmentStatus === "READY_TO_PACK" &&
    inv.status !== "VOID" &&
    inv.status !== "RETURNED" &&
    inv.status !== "DRAFT"
  ) {
    return { label: "Fulfillment", mode: "fulfill", tone: "production" };
  }
  if (inv.status === "DRAFT") {
    return { label: "Approve", mode: "approve", tone: "sales" };
  }
  if ((inv.status === "ISSUED" || inv.status === "PARTIAL") && inv.balance > 0) {
    return { label: "Bayar", mode: "pay", tone: "finance" };
  }
  if (
    inv.status === "PAID" &&
    (inv.fulfillmentStatus === "READY_TO_PACK" ||
      inv.fulfillmentStatus === "PACKED" ||
      inv.fulfillmentStatus === "SHIPPED")
  ) {
    return { label: "Fulfillment", mode: "fulfill", tone: "production" };
  }
  if (
    inv.status === "PAID" &&
    (inv.fulfillmentStatus === "AWAITING_PAYMENT" || inv.fulfillmentStatus === "NEEDS_PRODUCTION")
  ) {
    return { label: "Siapkan", mode: "prepare", tone: "production", href: "/penjualan/fulfillment" };
  }
  return { label: "", mode: null, tone: "neutral" };
}

// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
// LOT
// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export type LotNextAction = {
  label: string;
  href: string;
  tone: DomainTone;
};

/**
 * A green lot with remaining stock can be roasted directly. The link carries
 * the green-bean product + remaining weight so the roasting form opens
 * pre-filled (Lot ΓåÆ Roast continuity).
 */
export function deriveLotNextAction(lot: {
  productId?: string | null;
  productType?: string | null;
  quantityKg: number;
  id: string;
}): LotNextAction | null {
  if (lot.productType !== "GREEN_BEAN" || !lot.productId || lot.quantityKg <= 0) {
    return null;
  }
  const targetKg = Math.round(lot.quantityKg * 1000) / 1000;
  const href = `/roasting?mulai=1&gb=${encodeURIComponent(lot.productId)}&targetKg=${targetKg}&lotId=${encodeURIComponent(lot.id)}`;
  return { label: "Roast", href, tone: "roasting" };
}

