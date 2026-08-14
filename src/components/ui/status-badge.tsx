import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

/**
 * Status badge seragam untuk seluruh dashboard (roastd.id design system).
 * Tone memakai palet brand: verdigris (sukses), brass (menunggu), copper/rose
 * (perhatian), instrument (proses), plum (komersial), dan netral.
 */
const STATUS_TONES: Record<string, { label: string; className: string }> = {
  // Penjualan / Invoice
  DRAFT: { label: "Draft", className: "bg-muted text-muted-foreground border-border" },
  ISSUED: { label: "Tempo", className: "bg-amber-50 text-amber-700 border-amber-200" },
  PARTIAL: { label: "Sebagian", className: "bg-blue-50 text-blue-800 border-blue-200" },
  PAID: { label: "Lunas", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  RETURNED: { label: "Diretur", className: "bg-rose-50 text-rose-700 border-rose-200" },
  VOID: { label: "Void", className: "bg-muted text-muted-foreground border-border" },

  // Fulfillment pesanan (terpisah dari status pembayaran invoice)
  AWAITING_PAYMENT: { label: "Menunggu bayar", className: "bg-amber-50 text-amber-700 border-amber-200" },
  NEEDS_PRODUCTION: { label: "Perlu produksi", className: "bg-orange-50 text-orange-700 border-orange-200" },
  READY_TO_PACK: { label: "Siap dikemas", className: "bg-violet-50 text-violet-700 border-violet-200" },
  PACKED: { label: "Dikemas", className: "bg-blue-50 text-blue-800 border-blue-200" },
  SHIPPED: { label: "Dikirim", className: "bg-cyan-50 text-cyan-800 border-cyan-200" },
  DELIVERED: { label: "Diserahkan", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },

  // Roasting / Produksi
  PENDING: { label: "Proses", className: "bg-blue-50 text-blue-800 border-blue-200" },
  COMPLETED: { label: "Selesai", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  REVIEW: { label: "Review", className: "bg-amber-50 text-amber-700 border-amber-200" },

  // Purchase Order
  SENT: { label: "Terkirim", className: "bg-blue-50 text-blue-800 border-blue-200" },
  RECEIVED: { label: "Diterima", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CANCELLED: { label: "Dibatalkan", className: "bg-red-50 text-red-600 border-red-200" },

  // Kas & piutang
  GAJI: { label: "Gaji", className: "bg-blue-50 text-blue-800 border-blue-200" },
};

const DEFAULT_TONE = { label: "", className: "bg-muted text-muted-foreground border-border" };

export function StatusBadge({
  status,
  label,
  icon,
}: {
  status: string;
  label?: string;
  icon?: ReactNode;
}) {
  const tone = STATUS_TONES[status] ?? DEFAULT_TONE;
  return (
    <Badge variant="outline" className={`text-[11px] font-medium ${tone.className}`}>
      {icon && <span className="mr-1 inline-flex">{icon}</span>}
      {label ?? tone.label ?? status}
    </Badge>
  );
}
