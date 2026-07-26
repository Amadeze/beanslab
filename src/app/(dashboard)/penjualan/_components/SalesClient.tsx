"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ReceiptText,
  Loader2,
  Download,
  FileText as FileTextIcon,
  FileSpreadsheet,
  Gift,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRupiah, formatDate } from "@/lib/format";
import { StandardDrawer } from "@/components/StandardDrawer";
import { CompactHeader } from "@/components/layout/CompactHeader";
import { WorkspaceNav } from "@/components/layout/WorkspaceNav";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { InvoiceTable } from "./InvoiceTable";
import { InvoiceForm } from "./InvoiceForm";
import { CustomerForm } from "../../master-data/_components/CustomerForm";
import { SampleForm } from "./SampleForm";
import { SampleUsagePanel } from "./SampleUsagePanel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { CustomerOption, FGStockOption, InvoiceRow } from "../actions";
import type { SamplePageData } from "../sample-actions";
import { GlassPanel } from "@/components/ui/glass-panel";
import { SectionHeader } from "@/components/ui/section-header";
import { cn } from "@/lib/utils";

const triggerSilentPrint = (url: string) => {
  let iframe = document.getElementById(
    "silent-print-iframe",
  ) as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.id = "silent-print-iframe";
    iframe.style.position = "absolute";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.style.visibility = "hidden";
    document.body.appendChild(iframe);
  }
  iframe.src = url;
};

// ── Export dropdown (mobile header) ──

function ExportMenu({ invoices }: { invoices: InvoiceRow[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const exportPDF = () => {
    import("jspdf").then(({ jsPDF }) => {
      import("jspdf-autotable").then(({ default: autoTable }) => {
        const doc = new jsPDF();
        doc.text("Laporan Penjualan", 14, 15);
        const tableData = invoices.map((i) => [
          i.code,
          i.customerName,
          formatDate(i.issuedAt),
          i.status,
          formatRupiah(i.grandTotal),
        ]);
        autoTable(doc, {
          head: [["Kode Invoice", "Pelanggan", "Tanggal", "Status", "Total"]],
          body: tableData,
          startY: 20,
        });
        doc.save("Laporan_Penjualan.pdf");
      });
    });
    setOpen(false);
  };

  const exportExcel = async () => {
    const { default: writeXlsxFile } = await import("write-excel-file/browser");
    await writeXlsxFile(
      [
        ["Kode Invoice", "Pelanggan", "Tanggal", "Status", "Total"],
        ...invoices.map((invoice) => [
          invoice.code,
          invoice.customerName,
          formatDate(invoice.issuedAt),
          invoice.status,
          invoice.grandTotal,
        ]),
      ],
      { sheet: "Penjualan" },
    ).toFile("Laporan_Penjualan.xlsx");
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 transition-colors hover:bg-stone-50"
        aria-label="Export"
      >
        <Download size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-lg border border-stone-200 bg-white py-1 shadow-lg">
          <button
            onClick={exportPDF}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-slate-700 hover:bg-white/60 transition-colors"
          >
            <FileTextIcon size={14} className="text-slate-400" />
            Export PDF
          </button>
          <button
            onClick={exportExcel}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-slate-700 hover:bg-white/60 transition-colors"
          >
            <FileSpreadsheet size={14} className="text-slate-400" />
            Export Excel
          </button>
        </div>
      )}
    </div>
  );
}

interface SalesClientProps {
  invoices: InvoiceRow[];
  customers: CustomerOption[];
  fgOptions: FGStockOption[];
  sampleData: SamplePageData;
}

export function SalesClient({
  invoices,
  customers,
  fgOptions,
  sampleData,
}: SalesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sampleDrawerOpen, setSampleDrawerOpen] = useState(false);
  const [sampleSubmitting, setSampleSubmitting] = useState(false);
  const [workspace, setWorkspace] = useState<"sales" | "samples">("sales");
  const sampleDeepLinkHandled = useRef(false);
  const [customerOptions, setCustomerOptions] = useState(customers);
  const [preferredCustomerId, setPreferredCustomerId] = useState<string | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCustomerSubmitting, setIsCustomerSubmitting] = useState(false);
  const [lastInvoiceId, setLastInvoiceId] = useState<string | null>(null);

  // For Create Customer modal
  const [customerDrawerOpen, setCustomerDrawerOpen] = useState(false);

  useEffect(() => {
    setCustomerOptions(customers);
  }, [customers]);

  useEffect(() => {
    if (
      searchParams.get("action") === "sample" &&
      !sampleDeepLinkHandled.current
    ) {
      sampleDeepLinkHandled.current = true;
      setWorkspace("samples");
      setSampleDrawerOpen(true);
    }
  }, [searchParams]);

  // ── KPI computation with sparkline trends ──
  const { kpiCards, avgInvoice } = useMemo(() => {
    const valid = invoices.filter((i) => i.status !== "VOID");
    const totalRevenue = valid.reduce((sum, i) => sum + i.grandTotal, 0);
    const paidCount = valid.filter((i) => i.status === "PAID").length;
    const unpaidCount = valid.filter(
      (i) => i.status === "ISSUED" || i.status === "PARTIAL",
    ).length;
    const totalInvoices = valid.length;
    const avg =
      totalInvoices > 0 ? Math.round(totalRevenue / totalInvoices) : 0;

    return {
      kpiCards: { totalRevenue, paidCount, unpaidCount, totalInvoices },
      avgInvoice: avg,
    };
  }, [invoices]);

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Sticky header */}
        <CompactHeader
          title="Penjualan & Pesanan"
          stage="sales"
          description={`${kpiCards.paidCount} nota lunas · ${kpiCards.unpaidCount} nota tempo`}
          signal={{
            label: "Status",
            value: kpiCards.unpaidCount > 0
              ? `${kpiCards.unpaidCount} belum lunas`
              : "Semua lunas",
            tone: kpiCards.unpaidCount > 0 ? "critical" : "ready",
            onClick: kpiCards.unpaidCount > 0 ? () => setWorkspace("sales") : undefined,
          }}
          metrics={[
            { label: "Pendapatan", value: formatRupiah(kpiCards.totalRevenue) },
            { label: "Lunas", value: kpiCards.paidCount },
            { label: "Aktif", value: kpiCards.totalInvoices },
            { label: "Rata-rata", value: formatRupiah(avgInvoice) },
          ]}
          next={{ label: "Lanjut ke Kas & Piutang", href: "/keuangan" }}
          actions={
            <>
              <Button
                size="default"
                variant="outline"
                className="gap-2 rounded-lg px-4 font-semibold"
                onClick={() => {
                  setWorkspace("samples");
                  setSampleDrawerOpen(true);
                }}
              >
                <Gift size={16} />
                Kasih Sample
              </Button>
              <Button
                size="default"
                variant="outline"
                className="gap-2 rounded-lg px-4 font-semibold"
                onClick={() => {
                  import("jspdf").then(({ jsPDF }) => {
                    import("jspdf-autotable").then(({ default: autoTable }) => {
                      const doc = new jsPDF();
                      doc.text("Laporan Penjualan", 14, 15);
                      const tableData = invoices.map((i) => [
                        i.code,
                        i.customerName,
                        formatDate(i.issuedAt),
                        i.status,
                        formatRupiah(i.grandTotal),
                      ]);
                      autoTable(doc, {
                        head: [
                          [
                            "Kode Invoice",
                            "Pelanggan",
                            "Tanggal",
                            "Status",
                            "Total",
                          ],
                        ],
                        body: tableData,
                        startY: 20,
                      });
                      doc.save("Laporan_Penjualan.pdf");
                    });
                  });
                }}
              >
                Export PDF
              </Button>
              <Button
                size="default"
                variant="outline"
                className="gap-2 rounded-lg px-4 font-semibold"
                onClick={async () => {
                  const { default: writeXlsxFile } =
                    await import("write-excel-file/browser");
                  await writeXlsxFile(
                    [
                      [
                        "Kode Invoice",
                        "Pelanggan",
                        "Tanggal",
                        "Status",
                        "Total",
                      ],
                      ...invoices.map((invoice) => [
                        invoice.code,
                        invoice.customerName,
                        formatDate(invoice.issuedAt),
                        invoice.status,
                        invoice.grandTotal,
                      ]),
                    ],
                    { sheet: "Penjualan" },
                  ).toFile("Laporan_Penjualan.xlsx");
                }}
              >
                Export Excel
              </Button>
              <Button
                size="default"
                variant="default"
                className="gap-2 px-5"
                onClick={() => setDrawerOpen(true)}
              >
                <ReceiptText size={16} />
                Nota Baru
              </Button>
            </>
          }
          mobileActions={
            <>
              <ExportMenu invoices={invoices} />
              <Button
                size="sm"
                variant="default"
                className="gap-1.5 px-3"
                onClick={() => setDrawerOpen(true)}
              >
                <ReceiptText size={14} />
                Nota Baru
              </Button>
            </>
          }
        />

        {/* Scrollable content */}
        <div className="custom-scrollbar flex-1 overflow-auto">
          <WorkspaceNav kind="sales" />

          <div className="mx-auto max-w-[1600px] px-4 md:px-6 lg:px-8 pb-8 relative z-10">
            <Tabs
              value={workspace}
              onValueChange={(v) => setWorkspace(v as any)}
              className="w-full"
            >
              <div className="custom-scrollbar overflow-x-auto border-b border-[var(--glass-border)] mb-8 pb-1">
                <TabsList className="flex w-max items-center h-auto p-0 bg-transparent gap-2">
                  {[
                    { id: "sales", label: "Penjualan" },
                    {
                      id: "samples",
                      label: "Sample",
                      badge: sampleData.todaySummary.packCount,
                    },
                  ].map((tab) => {
                    const isActive = workspace === tab.id;
                    return (
                      <TabsTrigger
                        key={tab.id}
                        value={tab.id}
                        className={cn(
                          "relative flex items-center gap-2.5 px-4 py-3 text-sm font-semibold transition-all rounded-t-xl data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                          isActive
                            ? "text-[var(--amber-deep)] dark:text-[var(--amber-warm)]"
                            : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-hover)]",
                        )}
                      >
                        {tab.label}
                        {tab.badge !== undefined && (
                          <span
                            className={cn(
                              "ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition-colors",
                              isActive
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
                                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
                            )}
                          >
                            {tab.badge}
                          </span>
                        )}
                        {isActive && (
                          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[var(--amber-warm)] to-[var(--amber-deep)] rounded-t-full shadow-[0_-2px_10px_rgba(196,122,51,0.4)]" />
                        )}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>

              <div className="relative">
                <TabsContent
                  value="sales"
                  className="mt-0 outline-none animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-5">
                    <div className="lg:col-span-3 order-last lg:order-none">
                      <GlassPanel padding="md">
                        <InvoiceTable invoices={invoices} />
                      </GlassPanel>
                    </div>
                    <div className="lg:col-span-2 space-y-3 order-first lg:order-none">
                      <GlassPanel padding="md">
                        <SectionHeader
                          title="Aktivitas Sample"
                          description="Hari Ini"
                        />
                        <div className="mt-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-medium text-[var(--text-tertiary)]">
                              Sample diberikan
                            </span>
                            <span className="text-xs font-bold text-[var(--text-primary)]">
                              {sampleData.todaySummary.packCount} pack
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-medium text-[var(--text-tertiary)]">
                              Biaya
                            </span>
                            <span className="text-xs font-bold text-amber-600">
                              {formatRupiah(sampleData.todaySummary.totalCost)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-medium text-[var(--text-tertiary)]">
                              Bulan ini
                            </span>
                            <span className="text-xs font-bold text-[var(--text-primary)]">
                              {sampleData.monthSummary.packCount} pack &middot;{" "}
                              {formatRupiah(sampleData.monthSummary.totalCost)}
                            </span>
                          </div>
                        </div>
                      </GlassPanel>
                      <GlassPanel padding="md">
                        <SectionHeader title="Aksi Cepat" />
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setWorkspace("samples");
                              setSampleDrawerOpen(true);
                            }}
                            className="flex items-center gap-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)] transition-all"
                          >
                            <Gift size={14} />
                            Kasih Sample
                          </button>
                          <button
                            type="button"
                            onClick={() => setDrawerOpen(true)}
                            className="flex items-center gap-2 rounded-lg bg-[var(--amber-deep)] text-white px-3 py-2.5 text-xs font-semibold shadow-sm hover:brightness-110 transition-all"
                          >
                            <ReceiptText size={14} />
                            Nota Baru
                          </button>
                        </div>
                      </GlassPanel>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="samples" className="mt-0 outline-none">
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-5">
                    <div className="lg:col-span-3 order-last lg:order-none">
                      <GlassPanel padding="md">
                        <SampleUsagePanel data={sampleData} />
                      </GlassPanel>
                    </div>
                    <div className="lg:col-span-2 space-y-3 order-first lg:order-none">
                      <GlassPanel padding="md">
                        <SectionHeader
                          title="Ringkasan Bulanan"
                          description="Aktivitas sample"
                        />
                        <div className="mt-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-medium text-[var(--text-tertiary)]">
                              Total pack
                            </span>
                            <span className="text-xs font-bold text-[var(--text-primary)]">
                              {sampleData.monthSummary.packCount}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-medium text-[var(--text-tertiary)]">
                              Total berat
                            </span>
                            <span className="text-xs font-bold text-[var(--text-primary)]">
                              {sampleData.monthSummary.totalGrams.toLocaleString(
                                "id-ID",
                              )}{" "}
                              g
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-medium text-[var(--text-tertiary)]">
                              Biaya (HPP)
                            </span>
                            <span className="text-xs font-bold text-amber-600">
                              {formatRupiah(sampleData.monthSummary.totalCost)}
                            </span>
                          </div>
                        </div>
                      </GlassPanel>
                      <GlassPanel padding="md">
                        <SectionHeader title="Aksi Cepat" />
                        <button
                          type="button"
                          onClick={() => setSampleDrawerOpen(true)}
                          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--amber-deep)] text-white px-3 py-2.5 text-xs font-semibold shadow-sm hover:brightness-110 transition-all"
                        >
                          <Gift size={14} />
                          Sample Baru
                        </button>
                      </GlassPanel>
                    </div>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </div>

      <StandardDrawer
        open={sampleDrawerOpen}
        onOpenChange={(open) => {
          if (!sampleSubmitting) setSampleDrawerOpen(open);
        }}
        title="Kasih Sample"
        description="Catat sekali; stok, HPP promosi, dan closing langsung ikut diperbarui."
        size="lg"
        submitButton={
          <Button
            type="submit"
            form="sample-form"
            size="sm"
            disabled={sampleSubmitting}
            variant="default"
            className="gap-1.5"
          >
            {sampleSubmitting && <Loader2 size={13} className="animate-spin" />}
            {sampleSubmitting ? "Mencatat..." : "Catat & Kurangi Stok"}
          </Button>
        }
      >
        <SampleForm
          id="sample-form"
          data={sampleData}
          onPendingChange={setSampleSubmitting}
          onSuccess={() => {
            setSampleDrawerOpen(false);
            setWorkspace("samples");
            router.refresh();
          }}
        />
      </StandardDrawer>

      <StandardDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          if (!isSubmitting) setDrawerOpen(open);
        }}
        title="Terbitkan Nota Baru"
        description="Tambah item → atur harga → pilih status Lunas atau Tempo."
        size="xl"
        submitButton={
          <Button
            type="submit"
            form="invoice-form"
            size="sm"
            disabled={isSubmitting}
            className="gap-1.5 rounded-[8px] bg-primary font-bold text-primary-foreground shadow-md hover:bg-primary/90 disabled:opacity-60"
          >
            {isSubmitting && <Loader2 size={13} className="animate-spin" />}
            {isSubmitting ? "Menyimpan..." : "Terbitkan Nota"}
          </Button>
        }
      >
        <InvoiceForm
          id="invoice-form"
          customers={customerOptions}
          fgOptions={fgOptions}
          onSuccess={(invoiceId) => {
            setLastInvoiceId(invoiceId);
            setDrawerOpen(false);
            router.refresh();
          }}
          onPendingChange={setIsSubmitting}
          onAddCustomer={() => setCustomerDrawerOpen(true)}
          preferredCustomerId={preferredCustomerId}
        />
      </StandardDrawer>

      <StandardDrawer
        open={customerDrawerOpen}
        onOpenChange={(v) => {
          if (!isCustomerSubmitting) setCustomerDrawerOpen(v);
        }}
        title="Tambah Pelanggan Baru"
        size="md"
        submitButton={
          <Button
            type="submit"
            form="new-customer-form"
            size="sm"
            disabled={isCustomerSubmitting}
            className="gap-1.5 rounded-[8px] bg-primary font-bold text-primary-foreground shadow-md hover:bg-primary/90 disabled:opacity-60"
          >
            {isCustomerSubmitting && (
              <Loader2 size={13} className="animate-spin" />
            )}
            {isCustomerSubmitting ? "Menyimpan..." : "Simpan Pelanggan"}
          </Button>
        }
      >
        <CustomerForm
          id="new-customer-form"
          onPendingChange={setIsCustomerSubmitting}
          onSuccess={(customer) => {
            if (customer) {
              setCustomerOptions((current) => [
                customer,
                ...current.filter((item) => item.id !== customer.id),
              ]);
              setPreferredCustomerId(customer.id);
            }
            setCustomerDrawerOpen(false);
          }}
        />
      </StandardDrawer>

      <Dialog
        open={!!lastInvoiceId}
        onOpenChange={(open) => {
          if (!open) setLastInvoiceId(null);
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Nota Berhasil Terbit!</DialogTitle>
            <DialogDescription>
              Nota penjualan telah berhasil disimpan ke database. Anda dapat
              mencetak nota sekarang.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4 items-center justify-center">
            <ReceiptText
              size={48}
              className="text-emerald-500 mb-2 opacity-80"
            />
            <p className="text-sm font-medium text-slate-700 text-center">
              Apakah Anda ingin mencetak nota ini sekarang?
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLastInvoiceId(null)}>
              Nanti Saja
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                triggerSilentPrint(`/nota/${lastInvoiceId}?print=true`);
                setLastInvoiceId(null);
              }}
            >
              Cetak Nota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
