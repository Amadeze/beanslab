import { Package } from "lucide-react";

interface EmptyStateProps {
  label: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export function EmptyState({ label, description, action, icon }: EmptyStateProps) {
  return (
    <div className="instrument-grid flex min-h-56 flex-col items-center justify-center rounded-[12px] border border-dashed border-border bg-surface px-6 py-10 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[10px] border border-border bg-card text-primary shadow-[0_1px_0_rgba(5,9,13,.05)]">
        {icon || <Package size={21} />}
      </div>
      <p className="font-heading text-sm font-bold text-foreground">{label}</p>
      {description && (
        <p className="mt-1.5 max-w-sm text-xs leading-5 text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
