"use client";

import { useEffect, useState } from "react";
import { Loader2, PackageCheck } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatRupiah } from "@/lib/format";
import type { PODetail, POListItem } from "@/lib/po-lite";
import { getPODetail, getPOList } from "../po-actions";
import { ReceivePOForm } from "./ReceivePOForm";

interface QuickReceivePOProps {
  initialPoId?: string | null;
  refreshKey?: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export function QuickReceivePO({ initialPoId, refreshKey, onSuccess, onCancel }: QuickReceivePOProps) {
  const [options, setOptions] = useState<POListItem[]>([]);
  const [selectedPoId, setSelectedPoId] = useState(initialPoId ?? "");
  const [detail, setDetail] = useState<PODetail | null>(null);
  const [loading, setLoading] = useState(true);
  const selectedOption = options.find((po) => po.id === selectedPoId);

  useEffect(() => {
    setSelectedPoId(initialPoId ?? "");
  }, [initialPoId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [sent, partial] = await Promise.all([
          getPOList({ status: "SENT", limit: 100 }),
          getPOList({ status: "PARTIAL", limit: 100 }),
        ]);
        if (!cancelled) setOptions([...sent.items, ...partial.items]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedPoId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    getPODetail(selectedPoId)
      .then((data) => { if (!cancelled) setDetail(data); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedPoId]);

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Ambil dari Purchase Order
        </Label>
        <Select value={selectedPoId} onValueChange={(value) => setSelectedPoId(value ?? "")}>
          <SelectTrigger className="h-10 border-white/60 bg-white/50">
            <SelectValue placeholder={loading ? "Memuat PO..." : "Pilih PO yang akan diterima"}>
              {selectedOption
                ? `${selectedOption.code} · ${selectedOption.supplierName}`
                : detail
                  ? `${detail.code} · ${detail.supplierName}`
                  : undefined}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.map((po) => (
              <SelectItem key={po.id} value={po.id}>
                {po.code} · {po.supplierName} · {formatRupiah(po.totalEstimate)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[10px] text-slate-500">
          Supplier, item, sisa quantity, harga, dan estimasi ongkir ditarik otomatis dari PO.
        </p>
      </div>

      {loading && selectedPoId && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" /> Menarik data PO...
        </div>
      )}

      {!loading && options.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/30 px-4 py-10 text-center">
          <PackageCheck className="mx-auto mb-2 text-emerald-600" size={28} />
          <p className="text-sm font-bold text-slate-700">Tidak ada PO menunggu</p>
          <p className="mt-1 text-xs text-slate-500">Kirim PO terlebih dahulu sebelum mencatat penerimaan.</p>
        </div>
      )}

      {!loading && detail && (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black text-slate-900">{detail.code}</p>
                <p className="text-[11px] text-slate-600">{detail.supplierName}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-500">Estimasi PO</p>
                <p className="text-sm font-black text-slate-900">{formatRupiah(detail.totalEstimate)}</p>
              </div>
            </div>
          </div>

          <ReceivePOForm
            poId={detail.id}
            items={detail.items}
            estimatedShippingCost={detail.remainingShippingEstimate}
            onSuccess={onSuccess}
            onCancel={onCancel}
          />
        </div>
      )}
    </div>
  );
}
