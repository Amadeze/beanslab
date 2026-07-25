"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRupiah, formatDate as formatDateUtil } from "@/lib/format";
import { getPODetail, cancelPOAction } from "../po-actions";
import { ReceivePOForm } from "./ReceivePOForm";
import type { POStatus } from "@prisma/client";

// =============================================================================
// Types
// =============================================================================

type PODetailData = {
  id: string;
  code: string;
  status: POStatus;
  supplierName: string;
  expectedDate: string | null;
  totalEstimate: number;
  sentAt: string | null;
  receivedAt: string | null;
  createdAt: string;
  itemCount: number;
  notes: string | null;
  items: Array<{
    id: string;
    productName: string | null;
    packagingName: string | null;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    reorderPoint: number | null;
    currentStock: number | null;
  }>;
  purchases: Array<{
    id: string;
    code: string;
    receivedAt: string;
    totalCost: number;
  }>;
};

// =============================================================================
// Status Badge
// =============================================================================

function POStatusBadge({ status }: { status: POStatus }) {
  const map: Record<POStatus, { label: string; className: string }> = {
    DRAFT: { label: "Draft", className: "bg-slate-100 text-slate-600 border-slate-200" },
    SENT: { label: "Terkirim", className: "bg-blue-50 text-amber-800 border-blue-200" },
    PARTIAL: { label: "Sebagian", className: "bg-amber-50 text-amber-700 border-amber-200" },
    RECEIVED: { label: "Diterima", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    CANCELLED: { label: "Dibatalkan", className: "bg-red-50 text-red-600 border-red-200" },
  };
  const { label, className } = map[status];
  return (
    <Badge variant="outline" className={`text-[11px] font-medium ${className}`}>
      {label}
    </Badge>
  );
}

// =============================================================================
// Component
// =============================================================================

interface PODetailProps {
  poId: string;
  onClose: () => void;
  onUpdate: () => void;
}

export function PODetail({ poId, onClose, onUpdate }: PODetailProps) {
  const [detail, setDetail] = useState<PODetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReceiveForm, setShowReceiveForm] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPODetail(poId);
      setDetail(data);
    } finally {
      setLoading(false);
    }
  }, [poId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleCancel = async () => {
    if (!confirm("Batalkan PO ini?")) return;
    const result = await cancelPOAction(poId);
    if (result.success) {
      onUpdate();
      loadDetail();
    }
  };

  const handleReceiveSuccess = () => {
    setShowReceiveForm(false);
    onUpdate();
    loadDetail();
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return formatDateUtil(date);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-slate-400">Memuat detail PO...</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-slate-400">PO tidak ditemukan.</p>
      </div>
    );
  }

  const canReceive = detail.status === "SENT" || detail.status === "PARTIAL";
  const canCancel = detail.status === "DRAFT" || detail.status === "SENT";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">{detail.code}</h3>
          <p className="text-xs text-slate-500">Supplier: {detail.supplierName}</p>
        </div>
        <POStatusBadge status={detail.status} />
      </div>

      {/* Info */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-slate-500">Tanggal Dibuat:</span>
          <span className="ml-2 font-medium">{formatDate(detail.createdAt)}</span>
        </div>
        <div>
          <span className="text-slate-500">Perkiraan Datang:</span>
          <span className="ml-2 font-medium">{formatDate(detail.expectedDate)}</span>
        </div>
        {detail.sentAt && (
          <div>
            <span className="text-slate-500">Dikirim:</span>
            <span className="ml-2 font-medium">{formatDate(detail.sentAt)}</span>
          </div>
        )}
        {detail.receivedAt && (
          <div>
            <span className="text-slate-500">Diterima:</span>
            <span className="ml-2 font-medium">{formatDate(detail.receivedAt)}</span>
          </div>
        )}
      </div>

      {detail.notes && (
        <div className="text-xs">
          <span className="text-slate-500">Catatan:</span>
          <span className="ml-2">{detail.notes}</span>
        </div>
      )}

      {/* Items Table */}
      <div className="overflow-hidden rounded-xl border border-white/60 bg-white/30">
        <Table>
          <TableHeader>
            <TableRow className="bg-white/40">
              <TableHead className="text-[10px] font-bold uppercase">Item</TableHead>
              <TableHead className="text-[10px] font-bold uppercase text-right">Qty</TableHead>
              <TableHead className="text-[10px] font-bold uppercase text-right">Harga</TableHead>
              <TableHead className="text-[10px] font-bold uppercase text-right">Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="text-xs font-medium">
                  {item.productName || item.packagingName}
                </TableCell>
                <TableCell className="text-xs text-right">{item.quantity}</TableCell>
                <TableCell className="text-xs text-right">{formatRupiah(item.unitPrice)}</TableCell>
                <TableCell className="text-xs text-right font-bold">{formatRupiah(item.totalPrice)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Total */}
      <div className="flex justify-end items-center gap-2">
        <span className="text-xs font-bold text-slate-500">Total Estimasi:</span>
        <span className="text-lg font-black text-slate-900">{formatRupiah(detail.totalEstimate)}</span>
      </div>

      {/* Purchase History */}
      {detail.purchases.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-700">Riwayat Penerimaan</h4>
          <div className="overflow-hidden rounded-xl border border-white/60 bg-white/30">
            <Table>
              <TableHeader>
                <TableRow className="bg-white/40">
                  <TableHead className="text-[10px] font-bold uppercase">Kode</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase">Tanggal</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.purchases.map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell className="text-xs font-medium">{purchase.code}</TableCell>
                    <TableCell className="text-xs">{formatDate(purchase.receivedAt)}</TableCell>
                    <TableCell className="text-xs text-right font-bold">{formatRupiah(purchase.totalCost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose} className="bg-white/40 border-white/60">
          Tutup
        </Button>
        {canCancel && (
          <Button variant="outline" onClick={handleCancel} className="text-red-600 border-red-200 hover:bg-red-50">
            Batalkan
          </Button>
        )}
        {canReceive && (
          <Button onClick={() => setShowReceiveForm(true)} className="bg-domain-inventory text-white hover:bg-domain-inventory/90">
            Tandai Diterima
          </Button>
        )}
      </div>

      {/* Receive Form Modal */}
      {showReceiveForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-lg font-bold mb-4">Form Penerimaan Barang</h3>
            <ReceivePOForm
              poId={poId}
              items={detail.items}
              onSuccess={handleReceiveSuccess}
              onCancel={() => setShowReceiveForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
