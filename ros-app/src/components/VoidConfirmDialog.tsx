"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";

interface VoidConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: (reason: string) => Promise<{ success: boolean; error?: string }>;
}

export function VoidConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
}: VoidConfirmDialogProps) {
  const [reason,    setReason]    = useState("");
  const [loading,   setLoading]   = useState(false);

  const handleConfirm = async () => {
    if (!reason.trim()) { toast.error("Alasan void wajib diisi."); return; }
    setLoading(true);
    try {
      const result = await onConfirm(reason.trim());
      if (!result.success) { toastSafe.error(result.error ?? "Gagal void."); return; }
      toast.success("Berhasil di-void.");
      setReason("");
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v: boolean) => { if (!v) setReason(""); onOpenChange(v); }}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-red-600">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-zinc-500">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="my-2 space-y-1.5">
          <Label className="text-xs font-medium text-zinc-700">
            Alasan Void <span className="text-red-500">*</span>
          </Label>
          <Input
            placeholder="Contoh: Input salah, stok koreksi..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-9 text-sm"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel className="h-9 text-sm" disabled={loading}>
            Batal
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading || !reason.trim()}
            className="h-9 bg-red-600 text-sm hover:bg-red-700 focus:ring-red-500"
          >
            {loading ? "Memproses..." : "Ya, Void Transaksi"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
