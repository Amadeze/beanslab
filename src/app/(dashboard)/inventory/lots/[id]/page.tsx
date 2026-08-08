import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { CompactHeader } from "@/components/layout/CompactHeader";
import { traceLot, getLotPlacement } from "../../lot-actions";
import { getCurrentTenantId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PlacementForm } from "./_components/PlacementForm";

export default async function LotTracePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await traceLot(id);
  if (!("lot" in result)) notFound();

  const placement = await getLotPlacement(id);
  if (!placement) notFound();

  const tenantId = await getCurrentTenantId();
  const locations = await prisma.location.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, code: true, name: true, warehouse: { select: { name: true } } },
  });

  const availableLocations = locations.map((loc) => ({
    id: loc.id,
    code: loc.code,
    name: loc.name,
    warehouseName: loc.warehouse.name,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6 lg:p-8">
      <CompactHeader
        title={`Jejak Lot ${result.lot.batchCode}`}
        description="Asal barang dan mutasi inventory yang telah terhubung ke lot ini."
        actions={(
          <div className="flex gap-2">
            <Button variant="outline" render={<Link href={`/inventory/lots/${id}/label`} />}><Printer size={14} /> Label</Button>
            <Button variant="outline" render={<Link href="/inventory/lots" />}><ArrowLeft size={14} /> Kembali</Button>
          </div>
        )}
      />
      <GlassPanel padding="lg">
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-muted-foreground">Produk</dt><dd className="font-semibold">{result.lot.productName ?? result.lot.packagingName ?? "-"}</dd></div>
          <div><dt className="text-muted-foreground">Supplier</dt><dd className="font-semibold">{result.lot.supplierName ?? "-"}</dd></div>
          <div><dt className="text-muted-foreground">Diterima</dt><dd className="font-semibold">{new Date(result.lot.receivedAt).toLocaleDateString("id-ID")}</dd></div>
          <div><dt className="text-muted-foreground">Review / Best Before</dt><dd className="font-semibold">{result.lot.expiryDate ? new Date(result.lot.expiryDate).toLocaleDateString("id-ID") : "Tidak ditentukan"}</dd></div>
        </dl>
      </GlassPanel>
      <GlassPanel padding="lg">
        <h2 className="mb-4 text-base font-bold">Timeline</h2>
        <ol className="space-y-3">
          {result.steps.map((step, index) => (
            <li key={`${step.stage}-${index}`} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-900 text-xs font-bold text-white">{index + 1}</span>
              <div className="rounded-lg border border-stone-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2"><strong>{step.label}</strong><span className="font-mono text-xs text-muted-foreground">{step.code ?? "-"}</span></div>
                <p className="mt-1 text-sm text-muted-foreground">{step.notes ?? step.quantity ?? "Tidak ada catatan"}</p>
                {step.date ? <time className="mt-2 block text-xs text-muted-foreground">{new Date(step.date).toLocaleString("id-ID")}</time> : null}
              </div>
            </li>
          ))}
        </ol>
      </GlassPanel>

      <PlacementForm
        lotId={id}
        availableLocations={availableLocations}
        existingPlacements={placement.placements}
        remainingKg={placement.remainingKg}
      />

      <GlassPanel padding="lg">
        <h2 className="mb-4 text-base font-bold">Penempatan Lokasi</h2>
        {placement.placements.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Lot ini belum ditempatkan di lokasi manapun (Belum Ditempatkan).
          </p>
        ) : (
          <div className="space-y-2">
            {placement.placements.map((p) => (
              <div key={p.locationId} className="flex items-center justify-between rounded-md border bg-white/5 p-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="font-medium text-sm">{p.locationName}</span>
                    <span className="text-xs text-muted-foreground"> — {p.warehouseName}</span>
                  </div>
                </div>
                <span className="font-mono text-sm">
                  {p.quantityKg > 0
                    ? `${p.quantityKg.toLocaleString("id-ID")} kg`
                    : p.quantityUnit > 0
                      ? `${p.quantityUnit} unit`
                      : `${p.supplyQty.toLocaleString("id-ID")} pcs`}
                </span>
              </div>
            ))}
          </div>
        )}
        {placement.unplacedKg > 0 && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50/30 p-3">
            <p className="text-xs text-amber-800">
              Belum ditempatkan: {placement.unplacedKg.toLocaleString("id-ID")} kg
            </p>
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
