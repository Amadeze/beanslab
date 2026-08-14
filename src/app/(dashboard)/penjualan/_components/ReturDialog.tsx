"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatRupiah } from "@/lib/format";
import { toast } from "sonner";
import { createCreditNote, getInvoiceForReturn } from "../actions";
import type { InvoiceReturnData } from "../actions";

export function ReturDialog({
  invoiceId,
  open,
  onOpenChange,
  onSuccess,
}: {
  invoiceId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess?: () => void;
}) {
  const [data, setData] = useState<InvoiceReturnData | null>(null);
  const [reason, setReason] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && invoiceId) {
      setLoading(true);
      getInvoiceForReturn(invoiceId)
        .then((result) => {
          setData(result);
          if (result) {
            const initial: Record<string, number> = {};
            result.items.forEach((item) => {
              initial[item.productId] = 0;
            });
            setQuantities(initial);
          }
        })
        .catch((e) => toast.error(e.message))
        .finally(() => setLoading(false));
    } else {
      setData(null);
      setReason("");
      setQuantities({});
    }
  }, [open, invoiceId]);

  const totalReturn = data
    ? Object.entries(quantities).reduce((sum, [pid, qty]) => {
        const item = data.items.find((i) => i.productId === pid);
        const price = item ? Number(item.unitPrice) - Number(item.unitDiscount) : 0;
        return sum + price * qty;
      }, 0)
    : 0;

  const hasAnyReturn = Object.values(quantities).some((q) => q > 0);

  async function handleSubmit() {
    const normalizedReason = reason.trim();
    if (!invoiceId || normalizedReason.length < 3 || normalizedReason.length > 500) return;
    setSaving(true);
    try {
      const items = Object.entries(quantities)
        .filter(([, qty]) => qty > 0)
        .map(([productId, quantity]) => ({ productId, quantity }));

      const res = await createCreditNote({ invoiceId, reason: normalizedReason, items });
      if (res.success) {
        toast.success(`Retur ${res.creditNoteCode} berhasil`);
        onSuccess?.();
        onOpenChange(false);
      } else {
        toast.error(res.error ?? "Gagal");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Gagal");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Retur Penjualan</DialogTitle>
          <DialogDescription>
            {data
              ? `Nota ${data.code} — ${data.customerName}`
              : "Memuat data nota..."}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="py-8 text-center text-sm text-stone-400">Memuat...</div>
        )}

        {data && (
          <div className="space-y-4">
            <div className="space-y-3">
              {data.items.map((item) => {
                const maxReturn = item.quantity - item.returnedQuantity;
                if (maxReturn <= 0) return null;
                return (
                  <div key={item.productId} className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-stone-800">{item.productName}</p>
                      <p className="text-xs text-stone-400">
                        Terjual {item.quantity} · Sudah diretur {item.returnedQuantity} ·
                        Harga {formatRupiah(Number(item.unitPrice) - Number(item.unitDiscount))}
                      </p>
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        min={0}
                        max={maxReturn}
                        value={quantities[item.productId] ?? 0}
                        onChange={(e) => {
                          const v = Math.min(maxReturn, Math.max(0, Number(e.target.value) || 0));
                          setQuantities((prev) => ({ ...prev, [item.productId]: v }));
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Alasan Retur</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Cacat, salah produk, expired, dll."
                rows={2}
                maxLength={500}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg bg-stone-50 px-4 py-3">
              <span className="text-sm font-medium text-stone-600">Total Retur</span>
              <span className="font-mono text-lg font-bold text-stone-800">
                {formatRupiah(totalReturn)}
              </span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button
            onClick={handleSubmit}
            disabled={!hasAnyReturn || reason.trim().length < 3 || reason.trim().length > 500 || saving || !data}
          >
            {saving ? "Memproses..." : "Buat Retur"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
