import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { traceLot } from "../../../lot-actions";
import { PrintLabelButton } from "./PrintLabelButton";

export const dynamic = "force-dynamic";

export default async function LotLabelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await traceLot(id);
  if (!("lot" in result)) notFound();

  const appUrl = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
    .replace(/\/$/, "");
  const traceUrl = `${appUrl}/inventory/lots/${result.lot.id}`;
  const qrDataUrl = await QRCode.toDataURL(traceUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
  });
  const productName = result.lot.productName ?? result.lot.packagingName ?? "Barang";
  const remaining = result.lot.quantityKg > 0
    ? `${result.lot.quantityKg.toLocaleString("id-ID")} kg`
    : result.lot.quantityUnit > 0
      ? `${result.lot.quantityUnit.toLocaleString("id-ID")} unit`
      : "0 (habis)";

  return (
    <main className="min-h-screen bg-stone-100 p-5 print:bg-white print:p-0">
      <style>{`
        @media print {
          @page { size: 100mm 60mm; margin: 0; }
          body { background: white !important; }
          .lot-label { box-shadow: none !important; border: 0 !important; }
        }
      `}</style>
      <div className="mx-auto mb-4 flex max-w-[100mm] items-center justify-between gap-3 print:hidden">
        <Button variant="outline" render={<Link href={`/inventory/lots/${id}`} />}>
          <ArrowLeft size={15} /> Kembali
        </Button>
        <PrintLabelButton />
      </div>

      <article className="lot-label mx-auto grid h-[60mm] w-[100mm] grid-cols-[1fr_36mm] overflow-hidden rounded-md border-2 border-stone-900 bg-white shadow-xl">
        <section className="flex min-w-0 flex-col p-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-stone-500">roastd.id · Lot Internal</p>
          <h1 className="mt-1 break-words font-mono text-[17px] font-black leading-tight text-stone-950">
            {result.lot.batchCode}
          </h1>
          <p className="mt-2 line-clamp-2 text-[13px] font-bold leading-tight text-stone-900">{productName}</p>

          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[9px] leading-tight">
            <div><dt className="uppercase text-stone-500">Diterima</dt><dd className="font-bold">{new Date(result.lot.receivedAt).toLocaleDateString("id-ID")}</dd></div>
            <div><dt className="uppercase text-stone-500">Sisa tercatat</dt><dd className="font-bold">{remaining}</dd></div>
            <div><dt className="uppercase text-stone-500">Supplier</dt><dd className="truncate font-bold">{result.lot.supplierName ?? "-"}</dd></div>
            <div><dt className="uppercase text-stone-500">Review / BB</dt><dd className="font-bold">{result.lot.expiryDate ? new Date(result.lot.expiryDate).toLocaleDateString("id-ID") : "Tidak ditentukan"}</dd></div>
          </dl>
          <p className="mt-auto text-[8px] text-stone-500">Scan untuk membuka jejak lot dan mutasi stok.</p>
        </section>

        <aside className="flex flex-col items-center justify-center border-l-2 border-stone-900 p-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt={`QR jejak lot ${result.lot.batchCode}`} className="h-[30mm] w-[30mm]" />
          <p className="mt-1 break-all font-mono text-[7px] font-semibold leading-tight">{result.lot.batchCode}</p>
        </aside>
      </article>
    </main>
  );
}
