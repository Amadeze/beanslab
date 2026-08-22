"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Ringkasan",
  "control-tower": "Control Tower",
  suppliers: "Supplier",
  lots: "Lot & FEFO",
  gudang: "Gudang & Lokasi",
  opname: "Opname Lokasi",
  scan: "Stok per Lokasi",
  visual: "Peta Gudang",
  roasting: "Roasting",
  profiles: "Profil Roast",
  batch: "Batch",
  produksi: "Produksi",
  grinding: "Penggilingan",
  eksperimen: "Eksperimen",
  cupping: "Cupping",
  kasir: "Kasir",
  penjualan: "Penjualan",
  fulfillment: "Pemenuhan Pesanan",
  kontrak: "Kontrak OEM",
  pembayaran: "Bukti Bayar",
  pelanggan: "Pelanggan",
  katalog: "Produk & Resep",
  laporan: "Laporan",
  sales: "Penjualan",
  expenses: "Pengeluaran",
  stock: "Stok",
  production: "Produksi",
  analisa: "Analisa",
  "laba-rugi": "Laba Rugi",
  neraca: "Neraca",
  "alur-kopi": "Alur Kopi",
  "nilai-stok": "Nilai Stok",
  sample: "Sample",
  daily: "Harian",
  akuntansi: "Akuntansi",
  "arus-kas": "Arus Kas",
  "buku-besar": "Buku Besar",
  "laba-ditahan": "Laba Ditahan",
  "neraca-lajur": "Neraca Lajur",
  "perubahan-ekuitas": "Perubahan Ekuitas",
  integrity: "Integritas Data",
  "ai-insights": "Tanya Roastd",
  settings: "Pengaturan",
  organization: "Organisasi",
  team: "Tim",
  machines: "Mesin",
  notifications: "Notifikasi",
  payments: "Pembayaran",
  commerce: "Toko & Pengiriman",
  "portal-customizer": "Tampilan Storefront",
  integrations: "Integrasi",
  import: "Impor",
  studio: "Roastd Studio",
  "portal-preview": "Pratinjau Portal",
  audit: "Aktivitas & Audit",
  billing: "Paket & Tagihan",
};

const CONTEXT_LABELS: Array<{ segment: string; parent: string; label: string }> = [
  { segment: "inventory", parent: "/laporan", label: "Persediaan" },
  { segment: "keuangan", parent: "/laporan", label: "Laporan Keuangan" },
];

const HIDDEN_PREFIXES = ["/dashboard", "/kasir"];

export function Breadcrumbs() {
  const pathname = usePathname();
  if (HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return null;
  }

  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Array<{ label: string; href: string }> = [];
  let current = "";

  for (const segment of segments) {
    current += `/${segment}`;
    const contextual = CONTEXT_LABELS.find(
      (entry) => entry.segment === segment && crumbs[crumbs.length - 1]?.href === entry.parent,
    );
    const label = contextual?.label ?? SEGMENT_LABELS[segment];
    if (!label) continue;
    crumbs.push({ label, href: current });
  }

  if (crumbs.length < 2) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="mx-auto flex w-full max-w-[1600px] items-center gap-1 px-4 pt-3 sm:px-6 lg:px-8"
    >
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return (
          <span key={crumb.href} className="flex items-center gap-1">
            {index > 0 ? (
              <ChevronRight size={11} className="text-[var(--text-tertiary)]" />
            ) : null}
            {isLast ? (
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--text-tertiary)] transition hover:text-[var(--text-primary)]"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
