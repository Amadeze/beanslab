"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ReceiptText,
  Loader2,
  Download,
  FileText as FileTextIcon,
  FileSpreadsheet,
  Gift,
  ShoppingCart,
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
import type { ContractPriceOption, CustomerOption, FGStockOption, InvoiceRow } from "../actions";
import type { SamplePageData } from "../sample-actions";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/utils";
import { computeSalesKpis } from "@/lib/sales-kpis";

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

// ΓöÇΓöÇ Export dropdown (mobile header) ΓöÇΓöÇ

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

  const exportPDF = async () => {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
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
      head: [["Kode Nota", "Pelanggan", "Tanggal", "Status", "Total"]],
      body: tableData,
      startY: 20,
    });
    doc.save("Laporan_Penjualan.pdf");
    setOpen(false);
  };

  const exportExcel = async () => {
    const { default: writeXlsxFile } = await import("write-excel-file/browser");
    await writeXlsxFile(
      [
        ["Kode Nota", "Pelanggan", "Tanggal", "Status", "Total"],
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
        className="flex h-9 w-9 items-center justify-center rounded-card border border-border bg-card text-ink-secondary transition-colors hover:bg-surface-sunken"
        aria-label="Export"
      >
        <Download size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-card border border-border bg-card py-1 shadow-elevation-card">
          <button
            onClick={exportPDF}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-ink-secondary hover:bg-surface-sunken transition-colors"
          >
            <FileTextIcon size={14} className="text-ink-tertiary" />
            Export PDF
          </button>
          <button
            onClick={exportExcel}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-ink-secondary hover:bg-surface-sunken transition-colors"
          >
            <FileSpreadsheet size={14} className="text-ink-tertiary" />
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
  contractPrices: ContractPriceOption[];
  sampleData: SamplePageData;
}

export function SalesClient({
  invoices,
  customers,
  fgOptions,
  contractPrices,
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

  // ΓöÇΓöÇ KPI computation with sparkline trends ΓöÇΓöÇ
  // Basis pendapatan 2F.2: hanya nota DISERAHKAN (delivered), exclude VOID,
  // dikurangi nilai retur. Angka operasional ΓÇö P&L tetap basis GL.
  const { kpiCards, avgInvoice } = useMemo(() => {
    const kpis = computeSalesKpis(invoices);
    return { kpiCards: kpis, avgInvoice: kpis.avgInvoice };
  }, [invoices]);

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Sticky header */}
        <CompactHeader
          title="Penjualan & Pesanan"
          stage="sales"
          description="Pantau pesanan, pembayaran, dan fulfillment dari satu tabel operasional."
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
              <Link
                href="/kasir"
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold transition hover:bg-surface-sunken"
              >
                <ShoppingCart size={16} />
                Buka Kasir
              </Link>
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
                            "Kode Nota",
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
                        "Kode Nota",
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

          <div className="relative z-10 mx-auto max-w-[1600px] px-4 pb-8 sm:px-5 md:px-6 lg:px-8">
            <Tabs
              value={workspace}
              onValueChange={(v) => setWorkspace(v as any)}
              className="w-full"
            >
              <div className="custom-scrollbar mb-5 overflow-x-auto border-b border-border pb-1">
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
                          "relative flex items-center gap-2.5 rounded-t-[8px] px-4 py-3 text-sm font-semibold transition-all data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                          isActive
                            ? "text-domain-sales"
                            : "text-ink-tertiary hover:text-ink hover:bg-surface-sunken",
                        )}
                      >
                        {tab.label}
                        {tab.badge !== undefined && (
                          <span
                            className={cn(
                              "ml-1 rounded-full px-2 py-0.5 text-xs font-bold transition-colors",
                              isActive
                                ? "bg-plum-soft text-plum"
                                : "bg-surface-sunken text-ink-tertiary",
                            )}
                          >
                            {tab.badge}
                          </span>
                        )}
                        {isActive && (
                          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-domain-sales rounded-t-full" />
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
                      <InvoiceTable invoices={invoices} />
                    </div>
                    <div className="lg:col-span-2 space-y-3 order-first lg:order-none">
                      <Card>
                        <CardHeader>
                          <Eyebrow tone="muted">Aktivitas Sample</Eyebrow>
                          <CardDescription>Hari Ini</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-ink-tertiary">
                              Sample diberikan
                            </span>
                            <span className="text-xs font-bold text-ink">
                              {sampleData.todaySummary.packCount} pack
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-ink-tertiary">
                              Biaya
                            </span>
                            <span className="text-xs font-bold text-domain-sales">
                              {formatRupiah(sampleData.todaySummary.totalCost)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-ink-tertiary">
                              Bulan ini
                            </span>
                            <span className="text-xs font-bold text-ink">
                              {sampleData.monthSummary.packCount} pack &middot;{" "}
                              {formatRupiah(sampleData.monthSummary.totalCost)}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <Eyebrow tone="muted">Aksi Cepat</Eyebrow>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setWorkspace("samples");
                                setSampleDrawerOpen(true);
                              }}
                              className="flex items-center gap-2 rounded-card border border-border bg-surface-sunken px-3 py-2.5 text-xs font-semibold text-ink-secondary transition-all hover:bg-border"
                            >
                              <Gift size={14} />
                              Kasih Sample
                            </button>
                            <button
                              type="button"
                              onClick={() => setDrawerOpen(true)}
                              className="flex items-center gap-2 rounded-card bg-domain-sales px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-domain-sales/90"
                            >
                              <ReceiptText size={14} />
                              Nota Baru
                            </button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="samples" className="mt-0 outline-none">
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-5">
                    <div className="lg:col-span-3 order-last lg:order-none">
                      <SampleUsagePanel data={sampleData} />
                    </div>
                    <div className="lg:col-span-2 space-y-3 order-first lg:order-none">
                      <Card>
                        <CardHeader>
                          <Eyebrow tone="muted">Ringkasan Bulanan</Eyebrow>
                          <CardDescription>Aktivitas sample</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-ink-tertiary">
                              Total pack
                            </span>
                            <span className="text-xs font-bold text-ink">
                              {sampleData.monthSummary.packCount}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-ink-tertiary">
                              Total berat
                            </span>
                            <span className="text-xs font-bold text-ink">
                              {sampleData.monthSummary.totalGrams.toLocaleString(
                                "id-ID",
                              )}{" "}
                              g
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-ink-tertiary">
                              Biaya (HPP)
                            </span>
                            <span className="text-xs font-bold text-domain-sales">
                              {formatRupiah(sampleData.monthSummary.totalCost)}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <Eyebrow tone="muted">Aksi Cepat</Eyebrow>
                        </CardHeader>
                        <CardContent>
                          <button
                            type="button"
                            onClick={() => setSampleDrawerOpen(true)}
                            className="mt-0 flex w-full items-center justify-center gap-2 rounded-card bg-domain-sales px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-domain-sales/90"
                          >
                            <Gift size={14} />
                            Sample Baru
                          </button>
                        </CardContent>
                      </Card>
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
        description="Tambah item ΓåÆ atur harga ΓåÆ pilih status Lunas atau Tempo."
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
          contractPrices={contractPrices}
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
              className="text-[var(--status-success)] mb-2 opacity-80"
            />
            <p className="text-sm font-medium text-ink text-center">
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

