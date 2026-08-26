import { requireRole } from "@/lib/auth";
import { CompactHeader } from "@/components/layout/CompactHeader";
import { WorkspaceNav } from "@/components/layout/WorkspaceNav";
import { VisualWarehouseMap } from "./_components/VisualWarehouseMap";
import { getVisualWarehouseMap } from "./actions";
import Link from "next/link";
import { ScanLine } from "lucide-react";
import { Suspense } from "react";

export default async function VisualWarehousePage() {
  await requireRole("OWNER", "MANAGER", "OPERATOR");
  const map = await getVisualWarehouseMap();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CompactHeader
        title="Peta Gudang"
        description="Temukan stok, kapasitas, dan risiko setiap lokasi penyimpanan."
        stage="warehouse"
        actions={
          <Link
            href="/gudang/scan"
            className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-white/15 bg-white/[0.06] px-4 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C8DF]"
          >
            <ScanLine size={16} /> Pindai lokasi
          </Link>
        }
      />
      <div className="custom-scrollbar flex-1 overflow-auto">
        <Suspense fallback={null}>
          <WorkspaceNav kind="warehouse" />
        </Suspense>
        <div className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8">
          <VisualWarehouseMap warehouses={map.warehouses} />
        </div>
      </div>
    </div>
  );
}
