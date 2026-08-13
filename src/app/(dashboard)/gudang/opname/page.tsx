import { requireRole } from "@/lib/auth";
import { CompactHeader } from "@/components/layout/CompactHeader";
import { WorkspaceNav } from "@/components/layout/WorkspaceNav";
import { OpnameDraftClient } from "./_components/OpnameDraftClient";
import { OpnameDraftList } from "./_components/OpnameDraftList";
import { getOpnameItems, getOpnameWarehouses, getOpnameDrafts } from "./actions";
import { Suspense } from "react";

export default async function OpnamePage() {
  await requireRole("OWNER", "MANAGER", "OPERATOR");

  const items = await getOpnameItems();
  const warehouses = await getOpnameWarehouses();
  const drafts = await getOpnameDrafts();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CompactHeader
        title="Opname Lokasi"
        description="Hitung dan sesuaikan stok fisik per lot per lokasi penyimpanan."
        stage="inventory"
      />
      <div className="custom-scrollbar flex-1 overflow-auto">
        <Suspense fallback={null}>
          <WorkspaceNav kind="supply" />
        </Suspense>
        <div className="mx-auto max-w-[1200px] p-4 md:p-6 lg:p-8">
          <Suspense fallback={null}>
            <OpnameDraftClient items={items} warehouses={warehouses} />
          </Suspense>
          <div className="mt-8">
            <OpnameDraftList initialDrafts={drafts} />
          </div>
        </div>
      </div>
    </div>
  );
}
