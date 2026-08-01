"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Boxes, History, ClipboardList, Download, FileText, FileSpreadsheet, Loader2, MoreHorizontal, Package, Plus, Settings2, Truck, ArrowDownCircle, ArrowUpCircle, AlertTriangle, XCircle, Clock, CheckCircle2, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { StandardDrawer } from "@/components/StandardDrawer";
import { StockTable } from "./StockTable";
import { PurchaseForm } from "./PurchaseForm";
import { PackagingPurchaseForm } from "./PackagingPurchaseForm";
import { StockAdjustmentDrawer } from "./StockAdjustmentDrawer";
import { LedgerHistoryTable } from "./LedgerHistoryTable";
import { POList } from "./POList";
import { PODetail } from "./PODetail";
import { POForm } from "./POForm";
import { ReceivingList } from "./ReceivingList";
import { QuickReceivePO } from "./QuickReceivePO";
import { CompactHeader } from "@/components/layout/CompactHeader";
import { WorkspaceNav } from "@/components/layout/WorkspaceNav";
import { SupplierForm } from "../../master-data/_components/SupplierForm";
import type {
  GBProductOption,
  LedgerHistoryRow,
  PackagingStockRow,
  ProductStockRow,
  FGStockRow,
  ProductLotRow,
  SupplierOption,
  SampleConsumptionSummary,
} from "../actions";
import type { ReorderSummary } from "@/lib/reorder";
import { calcInventoryMetrics, isReorderConfigured } from "@/lib/inventory-utils";
import { formatRupiah } from "@/lib/format";

interface PackagingOption { id: string; name: string; code: string; costPerUnit: number; }

interface InventoryClientProps {
  gbStocks:   ProductStockRow[];
  rbStocks:   ProductStockRow[];
  fgStocks:   FGStockRow[];
  pkgStocks:  PackagingStockRow[];
  ledgerEntries: LedgerHistoryRow[];
  suppliers:  SupplierOption[];
  gbProducts: GBProductOption[];
  packagings: PackagingOption[];
  sampleConsumption: SampleConsumptionSummary;
  lotsByProduct?: Record<string, ProductLotRow[]>;
  productReorderSummaries?: ReorderSummary[];
  packagingReorderSummaries?: ReorderSummary[];
  poSummary?: {
    draft: number;
    sent: number;
    partial: number;
    received: number;
    cancelled: number;
    total: number;
  };
}

// ── Export helpers ──

function exportPDF(isLedger: boolean, gbStocks: ProductStockRow[], filteredLedger: LedgerHistoryRow[]) {
  import('jspdf').then(({ jsPDF }) => {
    import('jspdf-autotable').then(({ default: autoTable }) => {
      const doc = new jsPDF();
      doc.text(isLedger ? "Riwayat Mutasi Stok" : "Laporan Stok Green Bean", 14, 15);
      const tableData = isLedger
        ? filteredLedger.map((entry) => [
            new Date(entry.createdAt).toLocaleString("id-ID"),
            entry.itemCode,
            entry.itemName,
            entry.entryType,
            entry.quantity,
            entry.unit,
            entry.refType,
          ])
        : gbStocks.map(i => [i.name, i.stockKg, i.latestHppPerKg || 0]);
      autoTable(doc, {
        head: isLedger
          ? [["Waktu", "Kode", "Item", "Arah", "Jumlah", "Unit", "Referensi"]]
          : [['Nama Green Bean', 'Stok (Kg)', 'HPP/Kg']],
        body: tableData,
        startY: 20
      });
      doc.save(isLedger ? "Mutasi_Stok.pdf" : "Laporan_Stok.pdf");
    });
  });
}

async function exportExcel(isLedger: boolean, gbStocks: ProductStockRow[], filteredLedger: LedgerHistoryRow[]) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const rows = isLedger
    ? [
        ["Waktu", "Kode", "Item", "Arah", "Jumlah", "Unit", "Referensi", "ID Referensi", "Catatan", "Operator"],
        ...filteredLedger.map((entry) => [
          new Date(entry.createdAt).toLocaleString("id-ID"),
          entry.itemCode,
          entry.itemName,
          entry.entryType,
          entry.quantity,
          entry.unit,
          entry.refType,
          entry.refId,
          entry.notes ?? "",
          entry.createdByName,
        ]),
      ]
    : [
        ["Nama", "Stok (Kg)", "HPP/Kg"],
        ...gbStocks.map((item) => [
          item.name,
          item.stockKg,
          item.latestHppPerKg || 0,
        ]),
      ];
  await writeXlsxFile(rows, {
    sheet: isLedger ? "Ledger" : "Stok GB",
  }).toFile(isLedger ? "Mutasi_Stok.xlsx" : "Laporan_Stok.xlsx");
}

// ── Export dropdown ──

function ExportMenu({ onExportPDF, onExportExcel }: { onExportPDF: () => void; onExportExcel: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("mousedown", handleClick); document.removeEventListener("keydown", handleKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((p) => !p)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/60 bg-white/50 text-slate-600 hover:bg-white/70 transition-colors" aria-label="Export">
        <Download size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-36 rounded-lg border border-slate-200 bg-white shadow-lg py-0.5">
          <button onClick={() => { onExportPDF(); setOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            <FileText size={12} className="text-slate-400" /> PDF
          </button>
          <button onClick={() => { onExportExcel(); setOpen(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            <FileSpreadsheet size={12} className="text-slate-400" /> Excel
          </button>
        </div>
      )}
    </div>
  );
}

// ── Actions dropdown ──

function ActionsDropdown({ onStockOpname }: { onStockOpname: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("mousedown", handleClick); document.removeEventListener("keydown", handleKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative z-50">
      <button onClick={() => setOpen((p) => !p)} className="flex h-8 items-center gap-1 rounded-lg border border-slate-200/60 bg-white/50 px-2.5 text-xs font-medium text-slate-600 hover:bg-white/70 transition-colors" aria-label="Aksi lainnya">
        <Settings2 size={14} />
        <span className="hidden sm:inline">Opname</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-slate-200 bg-white shadow-xl py-1 overflow-hidden animate-in slide-in-from-top-1 fade-in">
          <button onClick={() => { onStockOpname(); setOpen(false); }} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors text-left">
            <Settings2 size={14} className="text-slate-400" /> Stock Opname
          </button>
        </div>
      )}
    </div>
  );
}

// ── Barang Datang Popup ──

function BarangDatangPopup({ onGBDatang, onKemasanDatang }: { onGBDatang: () => void; onKemasanDatang: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button onClick={() => setOpen(true)} className="flex h-9 items-center gap-1.5 rounded-[9px] bg-primary px-3 text-xs font-bold text-primary-foreground shadow-[0_8px_20px_-14px_rgba(91,32,17,.65)] transition-colors hover:bg-primary/90" aria-label="Barang Datang">
        <Plus size={14} />
        <span>Barang Datang</span>
      </button>
      <DialogContent className="sm:max-w-md border border-[var(--glass-border)] bg-white/95 shadow-2xl p-6 rounded-2xl">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-bold text-slate-800">Barang apa yang datang?</DialogTitle>
          <DialogDescription className="text-sm text-slate-500">Pilih jenis persediaan yang baru saja diterima.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button 
            onClick={() => { setOpen(false); onGBDatang(); }} 
            className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-slate-100 bg-white hover:border-amber-500 hover:bg-amber-50 hover:shadow-md transition-all group"
          >
            <div className="p-3 rounded-full bg-amber-100 text-amber-600 group-hover:scale-110 transition-transform">
              <Boxes size={28} />
            </div>
            <div className="text-center">
              <div className="font-bold text-slate-800">Green Bean (GB)</div>
              <div className="text-xs text-slate-500 mt-1">Bahan baku mentah</div>
            </div>
          </button>
          
          <button 
            onClick={() => { setOpen(false); onKemasanDatang(); }} 
            className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-slate-100 bg-white hover:border-orange-500 hover:bg-orange-50 hover:shadow-md transition-all group"
          >
            <div className="p-3 rounded-full bg-orange-100 text-orange-600 group-hover:scale-110 transition-transform">
              <Package size={28} />
            </div>
            <div className="text-center">
              <div className="font-bold text-slate-800">Kemasan Kosong</div>
              <div className="text-xs text-slate-500 mt-1">Gelas, box, plastik, dll</div>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Workspace tabs ──

type WorkspaceTab = "stock" | "po" | "receiving" | "mutations";

// ── Main component ──

export function InventoryClient({
  gbStocks, rbStocks, fgStocks, pkgStocks, ledgerEntries, suppliers, gbProducts, packagings, sampleConsumption,
  lotsByProduct,
  productReorderSummaries, packagingReorderSummaries, poSummary,
}: InventoryClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [gbDrawerOpen,  setGbDrawerOpen]  = useState(false);
  const [pkgDrawerOpen, setPkgDrawerOpen] = useState(false);
  const [adjDrawerOpen, setAdjDrawerOpen] = useState(false);
  const [poDrawerOpen, setPoDrawerOpen] = useState(false);
  const [poDetailOpen, setPoDetailOpen] = useState(false);
  const [receiptDrawerOpen, setReceiptDrawerOpen] = useState(false);
  const [supplierDrawerOpen, setSupplierDrawerOpen] = useState(false);
  const [supplierTarget, setSupplierTarget] = useState<"purchase" | "packaging" | "po" | null>(null);
  const [preferredSupplierId, setPreferredSupplierId] = useState<string | null>(null);
  const [supplierOptions, setSupplierOptions] = useState(suppliers);
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);
  const [selectedReceivingPoId, setSelectedReceivingPoId] = useState<string | null>(null);
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const [isSupplierSubmitting, setIsSupplierSubmitting] = useState(false);
  const [filteredLedger, setFilteredLedger] = useState(ledgerEntries);
  const [poRefreshKey, setPoRefreshKey] = useState(0);

  useEffect(() => {
    setSupplierOptions(suppliers);
  }, [suppliers]);

  const openSupplierQuickAdd = (target: "purchase" | "packaging" | "po") => {
    setSupplierTarget(target);
    setPreferredSupplierId(null);
    setSupplierDrawerOpen(true);
  };

  const finishSupplierFlow = () => {
    setSupplierTarget(null);
    setPreferredSupplierId(null);
  };

  // URL-synced workspace tab
  const viewParam = searchParams.get("view");
  const metricParam = searchParams.get("metric");
  const activeView: WorkspaceTab =
    viewParam === "po" || viewParam === "receiving" || viewParam === "mutations" ? viewParam : "stock";

  const toggleMetric = useCallback((metric: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (params.get("metric") === metric) {
      params.delete("metric");
    } else {
      params.set("metric", metric);
    }
    router.push(`?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const adjustmentItems = [
    ...gbStocks.map(i => ({ id: i.id, label: i.name, type: "GREEN_BEAN" as const, currentStock: Number(i.stockKg) })),
    ...rbStocks.map(i => ({ id: i.id, label: i.name, type: "ROASTED_BEAN" as const, currentStock: Number(i.stockKg) })),
    ...fgStocks.map(i => ({ id: i.id, label: i.name, type: "FINISHED_GOODS" as const, currentStock: Number(i.stockUnit) })),
    ...pkgStocks.map(i => ({ id: i.id, label: i.name, type: "PACKAGING" as const, currentStock: Number(i.stockUnit) })),
  ];

  const handlePORefresh = () => setPoRefreshKey((k) => k + 1);

  // ── Metrics per workspace ──

  const stockMetrics = useMemo(() => calcInventoryMetrics(gbStocks, rbStocks, fgStocks, pkgStocks, productReorderSummaries, packagingReorderSummaries), [gbStocks, rbStocks, fgStocks, pkgStocks, productReorderSummaries, packagingReorderSummaries]);

  const notConfiguredCount = useMemo(() => {
    let count = 0;
    const allProducts = [...gbStocks, ...rbStocks];
    const productMap = new Map<string, ReorderSummary>();
    for (const s of productReorderSummaries ?? []) productMap.set(s.skuId, s);
    const pkgMap = new Map<string, ReorderSummary>();
    for (const s of packagingReorderSummaries ?? []) pkgMap.set(s.skuId, s);
    for (const p of allProducts) { if (!isReorderConfigured(productMap.get(p.id))) count++; }
    for (const fg of fgStocks) { if (!isReorderConfigured(productMap.get(fg.id))) count++; }
    for (const pkg of pkgStocks) { if (!isReorderConfigured(pkgMap.get(pkg.id))) count++; }
    return count;
  }, [gbStocks, rbStocks, fgStocks, pkgStocks, productReorderSummaries, packagingReorderSummaries]);

  const poMetrics = useMemo(() => {
    if (!poSummary) return { active: 0, waiting: 0, partial: 0 };
    return {
      active: (poSummary.sent ?? 0) + (poSummary.partial ?? 0),
      waiting: poSummary.sent ?? 0,
      partial: poSummary.partial ?? 0,
    };
  }, [poSummary]);

  const receivingMetrics = useMemo(() => {
    const sent = poSummary?.sent ?? 0;
    const partial = poSummary?.partial ?? 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const receivedToday = new Set(
      ledgerEntries
        .filter((entry) =>
          entry.entryType === "IN" &&
          entry.refType.startsWith("PURCHASE") &&
          new Date(entry.createdAt) >= today,
        )
        .map((entry) => entry.refId),
    ).size;
    return {
      waitingToReceive: sent + partial,
      receivedToday,
    };
  }, [ledgerEntries, poSummary]);

  const mutationMetrics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEntries = ledgerEntries.filter((e) => new Date(e.createdAt) >= today);
    const inbound = todayEntries.filter((e) => e.entryType === "IN").length;
    const outbound = todayEntries.filter((e) => e.entryType === "OUT").length;
    const opname = todayEntries.filter((e) => e.refType === "ADJUSTMENT_IN" || e.refType === "ADJUSTMENT_OUT").length;
    return { inbound, outbound, opname, total: todayEntries.length };
  }, [ledgerEntries]);

  // ── Context-aware primary action ──

  const primaryAction = useMemo(() => {
    switch (activeView) {
      case "stock": return { label: "Barang Datang", icon: <Plus size={14} />, onClick: () => setGbDrawerOpen(true) };
      case "po": return { label: "Buat PO", icon: <Plus size={14} />, onClick: () => setPoDrawerOpen(true) };
      case "receiving": return {
        label: "Catat Penerimaan",
        icon: <Truck size={14} />,
        onClick: () => { setSelectedReceivingPoId(null); setReceiptDrawerOpen(true); },
      };
      case "mutations": return null;
    }
  }, [activeView]);

  // ── Compact header signal ──
  const headerSignal = useMemo(() => {
    switch (activeView) {
      case "stock":
        return stockMetrics.outOfStockCount > 0
          ? {
              label: "Sinyal",
              value: `${stockMetrics.outOfStockCount} habis`,
              tone: "critical" as const,
              onClick: () => toggleMetric("out-of-stock"),
              active: metricParam === "out-of-stock",
            }
          : { label: "Sinyal", value: "Terkendali", tone: "ready" as const };
      case "po":
        return poMetrics.active > 0
          ? {
              label: "PO",
              value: `${poMetrics.active} aktif`,
              tone: "ready" as const,
              onClick: () => toggleMetric("active"),
              active: metricParam === "active",
            }
          : { label: "PO", value: "Belum ada", tone: "neutral" as const };
      case "receiving":
        return receivingMetrics.waitingToReceive > 0
          ? {
              label: "Antrean",
              value: `${receivingMetrics.waitingToReceive} kiriman`,
              tone: "ready" as const,
              onClick: () => toggleMetric("waiting"),
              active: metricParam === "waiting",
            }
          : { label: "Antrean", value: "Kosong", tone: "neutral" as const };
      case "mutations":
        return { label: "Mutasi", value: `${mutationMetrics.total} hari ini`, tone: "neutral" as const };
    }
  }, [activeView, mutationMetrics, poMetrics, receivingMetrics, stockMetrics, metricParam, toggleMetric]);

  const headerMetrics = useMemo(() => {
    switch (activeView) {
      case "stock":
        return [
          { label: "Nilai", value: formatRupiah(stockMetrics.totalValue) },
          { label: "Habis", value: stockMetrics.outOfStockCount },
          { label: "Perlu pesan", value: stockMetrics.needsOrderCount },
        ];
      case "po":
        return [
          { label: "Aktif", value: poMetrics.active },
          { label: "Menunggu", value: poMetrics.waiting },
          { label: "Sebagian", value: poMetrics.partial },
        ];
      case "receiving":
        return [
          { label: "Menunggu", value: receivingMetrics.waitingToReceive },
          { label: "Hari ini", value: receivingMetrics.receivedToday },
        ];
      case "mutations":
        return [
          { label: "Masuk", value: mutationMetrics.inbound },
          { label: "Keluar", value: mutationMetrics.outbound },
          { label: "Opname", value: mutationMetrics.opname },
        ];
    }
  }, [activeView, mutationMetrics, poMetrics, receivingMetrics, stockMetrics]);

  const mobileFabItems = useMemo(() => {
    switch (activeView) {
      case "stock": return [
        { label: "Stock Opname", icon: <Settings2 size={16} />, onClick: () => setAdjDrawerOpen(true), variant: "secondary" as const },
        { label: "Kemasan Datang", icon: <Package size={16} />, onClick: () => setPkgDrawerOpen(true), variant: "secondary" as const },
        { label: "Barang Datang", icon: <Plus size={16} />, onClick: () => setGbDrawerOpen(true), variant: "primary" as const },
      ];
      case "po": return [
        { label: "Buat PO", icon: <ClipboardList size={16} />, onClick: () => setPoDrawerOpen(true), variant: "primary" as const },
      ];
      case "receiving": return [
        {
          label: "Catat Penerimaan",
          icon: <Truck size={16} />,
          onClick: () => { setSelectedReceivingPoId(null); setReceiptDrawerOpen(true); },
          variant: "primary" as const,
        },
      ];
      case "mutations": return undefined; // no FAB for mutations
    }
  }, [activeView]);

  // ── Export context ──
  const isMutations = activeView === "mutations";

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <CompactHeader
          title="Pasokan & Stok"
          description="Pembelian, penerimaan, posisi stok, supplier, dan seluruh jejak pergerakannya"
          stage="inventory"
          signal={headerSignal}
          metrics={headerMetrics}
          next={{ label: "Lanjut ke Roasting", href: "/roasting" }}
          actions={
            <>
              <ExportMenu
                onExportPDF={() => exportPDF(isMutations, gbStocks, filteredLedger)}
                onExportExcel={() => exportExcel(isMutations, gbStocks, filteredLedger)}
              />
              {activeView === "stock" ? (
                <>
                  <ActionsDropdown onStockOpname={() => setAdjDrawerOpen(true)} />
                  <BarangDatangPopup onGBDatang={() => setGbDrawerOpen(true)} onKemasanDatang={() => setPkgDrawerOpen(true)} />
                </>
              ) : (
                <>
                  {activeView !== "mutations" && <ActionsDropdown onStockOpname={() => setAdjDrawerOpen(true)} />}
                  {primaryAction && (
                    <Button size="sm" className="h-8 gap-1.5 rounded-[8px] text-xs font-bold shadow-md" onClick={primaryAction.onClick}>
                      {primaryAction.icon}
                      {primaryAction.label}
                    </Button>
                  )}
                </>
              )}
            </>
          }
          mobileActions={
            primaryAction ? (
              <Button size="sm" className="gap-1.5 px-3" onClick={primaryAction.onClick}>
                {primaryAction.icon}
                {primaryAction.label}
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="gap-1.5 px-3" onClick={() => setAdjDrawerOpen(true)}>
                <Settings2 size={14} />
                Opname
              </Button>
            )
          }
        />

        <div className="custom-scrollbar flex-1 overflow-auto">
          <WorkspaceNav kind="supply" />

        {/* ── Workspace Content ── */}
        <div className="mx-auto max-w-[1600px] px-4 md:px-6 lg:px-8 pb-8 relative z-10">
      {/* ── Sample Consumption Summary (Stock tab only) ── */}
      {activeView === "stock" && (sampleConsumption.rbConsumedKg > 0 || sampleConsumption.fgConsumedUnits > 0 || sampleConsumption.pkgConsumedUnits > 0) && (
        <div className="page-surface relative mb-5 overflow-hidden px-5 py-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-purple-500/5 pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[11px] font-black uppercase tracking-[0.1em] text-violet-700 dark:text-violet-400">Sample Bulan Ini</span>
                <span className="flex items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/50 px-2 py-0.5 text-[9px] font-bold text-violet-600 dark:text-violet-300">
                  {sampleConsumption.sampleCount} Transaksi
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[var(--text-secondary)]">
                {sampleConsumption.rbConsumedKg > 0 && <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-violet-400" />RB: <strong className="text-[var(--text-primary)]">{sampleConsumption.rbConsumedKg.toLocaleString("id-ID", { maximumFractionDigits: 2 })} kg</strong></span>}
                {sampleConsumption.fgConsumedUnits > 0 && <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-purple-400" />FG: <strong className="text-[var(--text-primary)]">{sampleConsumption.fgConsumedUnits.toLocaleString("id-ID")} unit</strong></span>}
                {sampleConsumption.pkgConsumedUnits > 0 && <span className="flex items-center gap-1.5"><div className="size-1.5 rounded-full bg-domain-sales" />PKG: <strong className="text-[var(--text-primary)]">{sampleConsumption.pkgConsumedUnits.toLocaleString("id-ID")} pcs</strong></span>}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-0.5">Total Biaya Sample</p>
              <p className="text-xl font-black text-[var(--text-primary)] tabular-nums tracking-tight">{formatRupiah(sampleConsumption.totalCost)}</p>
            </div>
          </div>
        </div>
      )}

        {/* ── Workspace Content ── */}
        <div>
          {activeView === "stock" && (
            <StockTable
              gbStocks={gbStocks}
              rbStocks={rbStocks}
              fgStocks={fgStocks}
              pkgStocks={pkgStocks}
              productReorderSummaries={productReorderSummaries}
              packagingReorderSummaries={packagingReorderSummaries}
              metricFilter={metricParam}
              lotsByProduct={lotsByProduct}
            />
          )}
          {activeView === "po" && (
            <POList
              refreshKey={poRefreshKey}
              onSelectPO={(poId) => { setSelectedPoId(poId); setPoDetailOpen(true); }}
              metricFilter={metricParam}
            />
          )}
          {activeView === "receiving" && (
            <ReceivingList
              refreshKey={poRefreshKey}
              onSelectPO={(poId) => {
                setSelectedReceivingPoId(poId);
                setReceiptDrawerOpen(true);
              }}
            />
          )}
          {activeView === "mutations" && (
            <LedgerHistoryTable entries={ledgerEntries} onFilteredEntriesChange={setFilteredLedger} />
          )}
        </div>
          </div>
        </div>
      </div>

      {/* ── Drawers ── */}
      <StandardDrawer open={gbDrawerOpen} onOpenChange={(open) => { if (!isSubmitting) setGbDrawerOpen(open); }} title="Catat Barang Datang (Green Bean)" description="Stok Green Bean akan bertambah otomatis setelah disimpan." size="lg"
        submitButton={<Button type="submit" form="purchase-form" size="sm" disabled={isSubmitting} className="gap-1.5 rounded-[8px] font-semibold disabled:opacity-60">{isSubmitting && <Loader2 size={13} className="animate-spin" />}{isSubmitting ? "Menyimpan..." : "Simpan"}</Button>}>
        <PurchaseForm id="purchase-form" suppliers={supplierOptions} gbProducts={gbProducts} onSuccess={() => { setGbDrawerOpen(false); finishSupplierFlow(); router.refresh(); }} onPendingChange={setIsSubmitting} onAddSupplier={() => openSupplierQuickAdd("purchase")} preferredSupplierId={supplierTarget === "purchase" ? preferredSupplierId : null} />
      </StandardDrawer>

      <StandardDrawer open={pkgDrawerOpen} onOpenChange={(open) => { if (!isSubmitting) setPkgDrawerOpen(open); }} title="Catat Kemasan Datang" description="Stok Kemasan akan bertambah otomatis setelah disimpan." size="md"
        submitButton={<Button type="submit" form="pkg-purchase-form" size="sm" disabled={isSubmitting} className="gap-1.5 rounded-[8px] font-semibold disabled:opacity-60">{isSubmitting && <Loader2 size={13} className="animate-spin" />}{isSubmitting ? "Menyimpan..." : "Simpan"}</Button>}>
        <PackagingPurchaseForm suppliers={supplierOptions} packagings={packagings} onPendingChange={setIsSubmitting} onAddSupplier={() => openSupplierQuickAdd("packaging")} preferredSupplierId={supplierTarget === "packaging" ? preferredSupplierId : null} onSuccess={() => { setPkgDrawerOpen(false); setIsSubmitting(false); finishSupplierFlow(); router.refresh(); }} />
      </StandardDrawer>

      <StandardDrawer open={adjDrawerOpen} onOpenChange={(open) => { if (!isSubmitting) setAdjDrawerOpen(open); }} title="Penyesuaian Stok (Opname)" description="Gunakan fitur ini untuk menyamakan stok digital dengan fisik." size="md"
        submitButton={<Button type="submit" form="adjustment-form" size="sm" disabled={isSubmitting} className="gap-1.5 rounded-[8px] font-semibold disabled:opacity-60">{isSubmitting && <Loader2 size={13} className="animate-spin" />}{isSubmitting ? "Menyimpan..." : "Simpan Opname"}</Button>}>
        <StockAdjustmentDrawer id="adjustment-form" items={adjustmentItems} onSuccess={() => setAdjDrawerOpen(false)} onPendingChange={setIsSubmitting} />
      </StandardDrawer>

      <StandardDrawer open={poDrawerOpen} onOpenChange={(open) => { if (!isSubmitting) setPoDrawerOpen(open); }} title="Buat Purchase Order" description="Buat PO baru untuk supplier." size="lg" showFooter={false}>
        <POForm suppliers={supplierOptions.map((s) => ({ id: s.id, name: s.name }))} products={gbStocks.map((p) => ({ id: p.id, name: p.name, type: p.type, stockKg: p.stockKg }))} packagings={packagings.map((p) => ({ id: p.id, name: p.name, stockUnit: 0 }))} onAddSupplier={() => openSupplierQuickAdd("po")} preferredSupplierId={supplierTarget === "po" ? preferredSupplierId : null} onSuccess={() => { setPoDrawerOpen(false); handlePORefresh(); finishSupplierFlow(); }} onCancel={() => { setPoDrawerOpen(false); finishSupplierFlow(); }} />
      </StandardDrawer>

      <StandardDrawer open={poDetailOpen} onOpenChange={setPoDetailOpen} title="Detail Purchase Order" size="lg" showFooter={false}>
        {selectedPoId && (
          <PODetail poId={selectedPoId} onClose={() => setPoDetailOpen(false)} onUpdate={handlePORefresh} />
        )}
      </StandardDrawer>

      <StandardDrawer
        open={receiptDrawerOpen}
        onOpenChange={setReceiptDrawerOpen}
        title="Catat Penerimaan PO"
        description="Tarik data PO, koreksi jumlah aktual dan ongkir, lalu simpan."
        size="lg"
        showFooter={false}
      >
        <QuickReceivePO
          initialPoId={selectedReceivingPoId}
          refreshKey={poRefreshKey}
          onSuccess={() => {
            setReceiptDrawerOpen(false);
            setSelectedReceivingPoId(null);
            handlePORefresh();
            router.refresh();
          }}
          onCancel={() => setReceiptDrawerOpen(false)}
        />
      </StandardDrawer>

      <StandardDrawer
        open={supplierDrawerOpen}
        onOpenChange={(open) => { if (!isSupplierSubmitting) setSupplierDrawerOpen(open); }}
        title="Tambah Supplier"
        description="Cukup isi nama. Supplier langsung dipilih di transaksi ini."
        size="sm"
        submitButton={
          <Button type="submit" form="quick-supplier-form" size="sm" disabled={isSupplierSubmitting} className="gap-1.5 rounded-[8px] font-semibold disabled:opacity-60">
            {isSupplierSubmitting && <Loader2 size={13} className="animate-spin" />}
            {isSupplierSubmitting ? "Menyimpan..." : "Simpan & pilih"}
          </Button>
        }
      >
        <SupplierForm
          id="quick-supplier-form"
          onPendingChange={setIsSupplierSubmitting}
          onSuccess={(supplier) => {
            if (supplier) {
              setSupplierOptions((current) => [
                supplier,
                ...current.filter((item) => item.id !== supplier.id),
              ]);
              setPreferredSupplierId(supplier.id);
            }
            setSupplierDrawerOpen(false);
          }}
        />
      </StandardDrawer>
    </>
  );
}
