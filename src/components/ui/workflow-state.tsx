import type { ReactNode } from "react";
import { WORKFLOW_TONE_CLASSES, type WorkflowTone } from "@/lib/workflow";

/**
 * Consolidated lifecycle chip. Replaces the old "two pills per row" pattern
 * (e.g. InvoiceStatus + FulfillmentStatus shown separately) with one
 * canonical stage so a row reads as a single state, not a stack of badges.
 */
export function WorkflowState({
  label,
  tone = "neutral",
  icon,
}: {
  label: string;
  tone?: WorkflowTone;
  icon?: ReactNode;
}) {
  if (!label) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${WORKFLOW_TONE_CLASSES[tone]}`}
    >
      {icon ? <span className="inline-flex">{icon}</span> : null}
      {label}
    </span>
  );
}

