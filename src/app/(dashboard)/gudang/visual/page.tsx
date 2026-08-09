import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { VisualWarehouseMap } from "./_components/VisualWarehouseMap";
import { getVisualWarehouseMap } from "./actions";
import Link from "next/link";
import { ArrowLeft, LayoutGrid, List } from "lucide-react";

export default async function VisualWarehousePage() {
  await requireRole("OWNER", "MANAGER", "OPERATOR");
  const map = await getVisualWarehouseMap();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Visual Gudang"
        description="Lihat tata letak gudang secara visual dengan status occupancy dan quick actions."
        actions={
          <Link
            href="/gudang"
            className="flex items-center gap-1 rounded-xl border border-[var(--glass-border)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] transition"
          >
            <ArrowLeft size={14} /> Kembali ke Gudang
          </Link>
        }
      />
      <div className="custom-scrollbar flex-1 overflow-auto">
        <div className="mx-auto max-w-[1400px] p-4 md:p-6 lg:p-8">
          <VisualWarehouseMap warehouses={map.warehouses} />
        </div>
      </div>
    </div>
  );
}
