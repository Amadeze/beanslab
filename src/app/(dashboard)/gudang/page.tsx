import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { generateQrDataUrl, encodeLocationQr } from "@/lib/qr";
import { PageHeader } from "@/components/layout/PageHeader";
import { GudangClient } from "./_components/GudangClient";
import { WarehouseRow } from "./warehouses/actions";
import { LocationRow } from "./locations/actions";

export default async function GudangPage() {
  const user = await requireRole("OWNER", "MANAGER");

  const warehouses = await prisma.warehouse.findMany({
    where: { tenantId: user.tenantId },
    include: { _count: { select: { locations: true } } },
    orderBy: { createdAt: "desc" },
  });

  const rawLocations = await prisma.location.findMany({
    where: {
      tenantId: user.tenantId,
      warehouse: { tenantId: user.tenantId },
    },
    include: { warehouse: true },
    orderBy: { createdAt: "desc" },
  });

  const warehouseRows: WarehouseRow[] = warehouses.map((w) => ({
    id: w.id,
    code: w.code,
    name: w.name,
    address: w.address,
    isActive: w.isActive,
    isDefault: w.isDefault,
    createdAt: w.createdAt.toISOString(),
    _count: { locations: w._count.locations },
  }));

  const locationRows: LocationRow[] = rawLocations.map((loc) => ({
    id: loc.id,
    warehouseId: loc.warehouseId,
    warehouseName: loc.warehouse.name,
    code: loc.code,
    name: loc.name,
    zone: loc.zone,
    isActive: loc.isActive,
    isDefault: loc.isDefault,
    createdAt: loc.createdAt.toISOString(),
  }));

  // Pre-generate QR data URLs for each location (server-side)
  const qrMap: Record<string, string> = {};
  for (const loc of rawLocations) {
    const payload = encodeLocationQr(loc.code);
    qrMap[loc.id] = await generateQrDataUrl(payload);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Gudang & Lokasi"
        description="Kelola gudang, rak, dan lokasi penyimpanan stok fisik."
      />
      <div className="custom-scrollbar flex-1 overflow-auto">
        <div className="mx-auto max-w-[1200px] p-4 md:p-6 lg:p-8">
          <GudangClient warehouses={warehouseRows} locations={locationRows} qrMap={qrMap} />
        </div>
      </div>
    </div>
  );
}
