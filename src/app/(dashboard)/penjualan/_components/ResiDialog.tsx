"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  updateInvoiceShipping,
  saveInvoiceAwb,
  refreshInvoiceTracking,
  getInvoiceTracking,
} from "../actions";
import type { InvoiceRow } from "../actions";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";
import { Truck, RefreshCw, Package } from "lucide-react";
import {
  nextOperatorFulfillmentStatuses,
  type OperatorFulfillmentStatus,
} from "@/lib/fulfillment-status";

const fulfillmentLabels: Partial<Record<OperatorFulfillmentStatus, string>> = {
  PACKED: "Sudah dikemas",
  SHIPPED: "Dalam pengiriman",
  DELIVERED: "Pesanan selesai",
};

interface TrackingState {
  awb: string;
  courierCode: string;
  providerStatus: string | null;
  providerDelivered: boolean;
  events: Array<{
    timestamp: string | null;
    description: string;
    location: string | null;
    status: string | null;
  }>;
  lastRefreshedAt: string | null;
}

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
  const [isTrackingLoading, setIsTrackingLoading] = useState(false);
  const [tracking, setTracking] = useState<TrackingState | null>(null);

  const loadTracking = useCallback(async () => {
    if (!invoice) return;
    try {
      const res = await getInvoiceTracking(invoice.id);
      if (res.success && res.tracking) {
        setTracking(res.tracking as TrackingState);
      } else {
        setTracking(null);
      }
    } catch {
      setTracking(null);
    }
  }, [invoice]);

  useEffect(() => {
    if (invoice && open) {
      setCourierName(invoice.courierName || "");
      setTrackingNumber(invoice.trackingNumber || "");
      setShippingCost(
        invoice.shippingCost ? invoice.shippingCost.toString() : "",
      );
      const nextStatuses = nextOperatorFulfillmentStatuses(
        invoice.fulfillmentStatus as OperatorFulfillmentStatus,
      );
      setFulfillmentStatus(nextStatuses[0] ?? invoice.fulfillmentStatus);
      loadTracking();
    } else {
      setTracking(null);
    }
  }, [invoice, open, loadTracking]);

  const handleSave = async () => {
    if (!invoice) return;
    setIsLoading(true);
    try {
      // Save AWB to InvoiceTracking if courier order with AWB
      if (
        invoice.shippingMethod === "COURIER" &&
        trackingNumber.trim() &&
        invoice.shippingCourierCode
      ) {
        const awbResult = await saveInvoiceAwb(invoice.id, {
          awb: trackingNumber.trim(),
        });
        if (!awbResult.success) {
          toastSafe.error(awbResult.error || "Gagal menyimpan AWB");
          return;
        }
      }

      const res = await updateInvoiceShipping(invoice.id, {
        courierName,
        trackingNumber,
        shippingCost: shippingCost ? Number(shippingCost) : 0,
        fulfillmentStatus,
      });
      if (res.error) {
        toastSafe.error(res.error);
      } else {
        toast.success("Data pengiriman berhasil diperbarui.");
        onOpenChange(false);
      }
    } catch (e: any) {
      toastSafe.error(e.message || "Terjadi kesalahan");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshTracking = async () => {
    if (!invoice) return;
    setIsTrackingLoading(true);
    try {
      const res = await refreshInvoiceTracking(invoice.id);
      if (res.error) {
        toastSafe.error(res.error);
      } else {
        setTracking(res.tracking as TrackingState);
        toast.success("Status pelacakan berhasil diperbarui.");
      }
    } catch (e: any) {
      toastSafe.error(e.message || "Gagal memperbarui tracking");
    } finally {
      setIsTrackingLoading(false);
    }
  };

  const isCourierOrder = invoice?.shippingMethod === "COURIER";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] rounded-[1.25rem] p-6 border-white/60 bg-card/70 backdrop-blur-xl shadow-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-ink">
            <Truck className="h-5 w-5 text-[var(--status-warning)]" />
            Update Pengiriman
          </DialogTitle>
          <DialogDescription className="text-ink-secondary">
            Perbarui tahap penyerahan, kurir, atau nomor resi untuk pesanan{" "}
            <strong className="text-ink">{invoice?.code}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {invoice?.shippingMethod && (
            <div className="text-xs font-semibold bg-[var(--status-warning)]/10 text-[var(--status-warning)] px-3 py-2 rounded-lg border border-[var(--status-warning)]/30">
              Metode: {invoice.shippingMethod}
            </div>
          )}
          {invoice?.shippingAddress && (
            <div className="text-xs text-ink bg-surface-sunken p-3 rounded-lg border border-border">
              <span className="font-bold block mb-1">Alamat Tujuan:</span>
              {invoice.shippingAddress}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-ink uppercase tracking-wide">
              Status Operasional
            </label>
            <select
              value={fulfillmentStatus}
              onChange={(event) => setFulfillmentStatus(event.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm"
            >
              {invoice
                ? nextOperatorFulfillmentStatuses(
                    invoice.fulfillmentStatus as OperatorFulfillmentStatus,
                  ).map((status) => (
                    <option key={status} value={status}>
                      {fulfillmentLabels[status] ?? status}
                    </option>
                  ))
                : null}
            </select>
          </div>
          {invoice?.shippingMethod !== "PICKUP" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink uppercase tracking-wide">
                {isCourierOrder ? "Nama Ekspedisi" : "Nama Kurir / Driver"}
              </label>
              <input
                className="h-10 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                placeholder={isCourierOrder ? "Contoh: JNE, J&T" : "Contoh: Budi, GoSend"}
                value={courierName}
                onChange={(e) => setCourierName(e.target.value)}
              />
            </div>
          )}

          {isCourierOrder && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-ink uppercase tracking-wide">
                Nomor Resi / AWB
              </label>
              <div className="flex gap-2">
                <input
                  className="h-10 flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                  placeholder="Masukkan nomor resi..."
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                />
                {trackingNumber.trim() && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshTracking}
                    disabled={isTrackingLoading}
                    className="h-10 rounded-xl px-3"
                    title="Lacak Pengiriman"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${isTrackingLoading ? "animate-spin" : ""}`}
                    />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Tracking Status Display */}
          {isCourierOrder && tracking && (
            <div className="rounded-xl border border-border bg-surface-sunken p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-ink">
                <Package className="h-3.5 w-3.5" />
                Status Pengiriman
              </div>
              {tracking.providerStatus && (
                <div className="text-sm font-semibold text-ink">
                  {tracking.providerStatus}
                </div>
              )}
              {tracking.lastRefreshedAt && (
                <div className="text-xs text-ink-secondary">
                  Terakhir diperbarui:{" "}
                  {new Date(tracking.lastRefreshedAt).toLocaleString("id-ID")}
                </div>
              )}
              {tracking.events && tracking.events.length > 0 && (
                <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                  {tracking.events.slice(0, 10).map((event, idx) => (
                    <div
                      key={idx}
                      className="text-xs border-l-2 border-[var(--status-warning)]/30 pl-2 py-0.5"
                    >
                      <div className="text-ink">{event.description}</div>
                      <div className="text-ink-secondary flex gap-2">
                        {event.timestamp && <span>{event.timestamp}</span>}
                        {event.location && <span>- {event.location}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-ink uppercase tracking-wide">
              Ongkos Kirim (Rp)
            </label>
            <input
              type="number"
              className="h-10 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
              placeholder="0"
              value={shippingCost}
              onChange={(e) => setShippingCost(e.target.value)}
            />
            <p className="text-xs text-ink-secondary">
              Ongkir akan ditambahkan ke total tagihan pesanan.
            </p>
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
