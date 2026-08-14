"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { updateInvoiceShipping } from "../actions";
import type { InvoiceRow } from "../actions";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";
import { Truck } from "lucide-react";
import {
  nextOperatorFulfillmentStatuses,
  type OperatorFulfillmentStatus,
} from "@/lib/fulfillment-status";

const fulfillmentLabels: Partial<Record<OperatorFulfillmentStatus, string>> = {
  PACKED: "Sudah dikemas",
  SHIPPED: "Dalam pengiriman",
  DELIVERED: "Pesanan selesai",
};

interface ResiDialogProps {
  invoice: InvoiceRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResiDialog({ invoice, open, onOpenChange }: ResiDialogProps) {
  const [courierName, setCourierName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [shippingCost, setShippingCost] = useState("");
  const [fulfillmentStatus, setFulfillmentStatus] = useState("SHIPPED");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (invoice && open) {
      setCourierName(invoice.courierName || "");
      setTrackingNumber(invoice.trackingNumber || "");
      setShippingCost(invoice.shippingCost ? invoice.shippingCost.toString() : "");
      const nextStatuses = nextOperatorFulfillmentStatuses(
        invoice.fulfillmentStatus as OperatorFulfillmentStatus,
      );
      setFulfillmentStatus(nextStatuses[0] ?? invoice.fulfillmentStatus);
    }
  }, [invoice, open]);

  const handleSave = async () => {
    if (!invoice) return;
    setIsLoading(true);
    try {
      const res = await updateInvoiceShipping(invoice.id, {
        courierName,
        trackingNumber,
        shippingCost: shippingCost ? Number(shippingCost) : 0,
        fulfillmentStatus,
      });
      if (res.error) {
        toastSafe.error(res.error);
      } else {
        toast.success("Data pengiriman berhasil diupdate");
        onOpenChange(false);
      }
    } catch (e: any) {
      toastSafe.error(e.message || "Terjadi kesalahan");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-[1.25rem] p-6 border-white/60 bg-white/70 backdrop-blur-xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-800">
            <Truck className="h-5 w-5 text-amber-600" />
            Update Pengiriman
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            Perbarui tahap penyerahan, kurir, atau nomor resi untuk pesanan <strong className="text-slate-800">{invoice?.code}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {invoice?.shippingMethod && (
             <div className="text-xs font-semibold bg-amber-50 text-amber-700 px-3 py-2 rounded-lg border border-amber-200">
               Metode: {invoice.shippingMethod}
             </div>
          )}
          {invoice?.shippingAddress && (
            <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="font-bold block mb-1">Alamat Tujuan:</span>
              {invoice.shippingAddress}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Status Operasional</label>
            <select value={fulfillmentStatus} onChange={(event) => setFulfillmentStatus(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
              {invoice ? nextOperatorFulfillmentStatuses(
                invoice.fulfillmentStatus as OperatorFulfillmentStatus,
              ).map((status) => (
                <option key={status} value={status}>{fulfillmentLabels[status] ?? status}</option>
              )) : null}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Nama Ekspedisi/Kurir</label>
            <input
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
              placeholder="Contoh: JNE, J&T, GoSend"
              value={courierName}
              onChange={(e) => setCourierName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Nomor Resi / Lacak</label>
            <input
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
              placeholder="Masukkan nomor resi..."
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Ongkos Kirim (Rp)</label>
            <input
              type="number"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
              placeholder="0"
              value={shippingCost}
              onChange={(e) => setShippingCost(e.target.value)}
            />
            <p className="text-xs text-slate-400">Ongkir akan ditambahkan ke total tagihan pesanan.</p>
          </div>
        </div>

        <DialogFooter className="sm:justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="rounded-xl"
            disabled={isLoading}
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isLoading}
            className="rounded-[9px] bg-primary font-bold tracking-wide text-primary-foreground hover:bg-primary/90"
          >
            {isLoading ? "Menyimpan..." : "Simpan Resi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
