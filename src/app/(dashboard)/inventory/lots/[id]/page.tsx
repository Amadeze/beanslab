import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { CompactHeader } from "@/components/layout/CompactHeader";
import { traceLot } from "../../lot-actions";

export default async function LotTracePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await traceLot(id);
  if (!("lot" in result)) notFound();

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
    </div>
  );
}
