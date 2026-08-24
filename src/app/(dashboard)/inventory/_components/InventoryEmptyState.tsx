import { Package } from "lucide-react";
import { EmptyState, type EmptyStateProps } from "@/components/shared/EmptyState";

export function InventoryEmptyState({ label, description, action, ...props }: EmptyStateProps) {
  return <EmptyState variant="table" label={label} description={description} action={action} colSpan={5} {...props} />;
}
