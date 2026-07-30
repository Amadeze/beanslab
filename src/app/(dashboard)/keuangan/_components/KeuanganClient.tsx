"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Minus, Plus, HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompactHeader } from "@/components/layout/CompactHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PiutangTable } from "./PiutangTable";
import { TerimaPaymentDialog } from "./TerimaPaymentDialog";
import { CatatPengeluaranDrawer } from "./CatatPengeluaranDrawer";
import { ExpenseTable } from "./ExpenseTable";
import { PurchaseTable } from "./PurchaseTable";
import { PaymentTable } from "./PaymentTable";
import { SupplierPaymentDialog } from "./SupplierPaymentDialog";
import { SupplierPaymentTable } from "./SupplierPaymentTable";
import { formatRupiah } from "@/lib/format";
import { CapitalTable } from "./CapitalTable";
import { CatatModalDialog } from "./CatatModalDialog";
import type {
  CapitalTransactionRow,
  CapitalSummary,
  ExpenseRow,
  KeuanganPageData,
  PaymentRow,
  PiutangRow,
  PurchaseRow,
  SupplierPaymentRow,
} from "../actions";
import {
  voidExpense,
  voidPayment,
  voidPurchase,
  voidSupplierPayment,
} from "../actions";
import { VoidConfirmDialog } from "@/components/VoidConfirmDialog";

type Tab =
  "piutang" | "pembayaran" | "pengeluaran" | "pembelian" | "pembayaranSupplier" | "modal";

interface KeuanganClientProps {
  data: KeuanganPageData;
  expenses: ExpenseRow[];
  purchases: PurchaseRow[];
  payments: PaymentRow[];
  supplierPayments: SupplierPaymentRow[];
  capitalTransactions: CapitalTransactionRow[];
  capitalSummary: CapitalSummary;
}

export function KeuanganClient({
  data,
  expenses,
  purchases,
  payments,
  supplierPayments,
  capitalTransactions,
  capitalSummary,
}: KeuanganClientProps) {
  const [selectedInvoice, setSelectedInvoice] = useState<PiutangRow | null>(
    null,
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("piutang");
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseRow | null>(
    null,
  );
  const [selectedExpense, setSelectedExpense] = useState<ExpenseRow | null>(
    null,
  );
  const [selectedPayment, setSelectedPayment] = useState<PaymentRow | null>(
    null,
  );
  const [supplierPaymentPurchase, setSupplierPaymentPurchase] =
    useState<PurchaseRow | null>(null);
  const [selectedSupplierPayment, setSelectedSupplierPayment] =
    useState<SupplierPaymentRow | null>(null);
  const [capitalDialogType, setCapitalDialogType] = useState<"INJECTION" | "WITHDRAWAL" | null>(null);

  const { kpi, piutangRows } = data;
  const overdueCount =
    kpi.agingBuckets.overdue1_30.count +
    kpi.agingBuckets.overdue31_60.count +
    kpi.agingBuckets.overdue61Plus.count;

  const handleTerimaPayment = (row: PiutangRow) => {
    setSelectedInvoice(row);
    setDialogOpen(true);
  };

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <CompactHeader
          title="Kas & Piutang"
          description="Piutang & penerimaan pembayaran"
          stage="finance"
          signal={{
            label: "Sinyal",
            value: overdueCount > 0 ? `${overdueCount} lewat tempo` : "Terkendali",
            tone: overdueCount > 0 ? "critical" : "ready",
            onClick: overdueCount > 0 ? () => setActiveTab("piutang") : undefined,
          }}
          metrics={[
            { label: "Piutang", value: formatRupiah(kpi.totalPiutang) },
            { label: "1-30hr", value: kpi.agingBuckets.overdue1_30.count },
            { label: "31-60hr", value: kpi.agingBuckets.overdue31_60.count },
            { label: "60+hr", value: kpi.agingBuckets.overdue61Plus.count },
          ]}
          actions={
            <Button
              variant="destructive"
              size="sm"
              className="h-8 gap-1.5 text-xs font-medium"
              onClick={() => setExpenseOpen(true)}
            >
              <Minus size={14} />
              Catat Pengeluaran
            </Button>
          }
          mobileActions={
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5 px-3 text-xs font-semibold"
              onClick={() => setExpenseOpen(true)}
            >
              <Minus size={14} />
              Pengeluaran
            </Button>
          }
        />

        <div className="custom-scrollbar flex-1 overflow-auto">
          <div className="relative z-10 mx-auto max-w-[1600px] px-4 pb-8 sm:px-5 md:px-6 lg:px-8">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as Tab)}
              className="w-full"
            >
              <div className="custom-scrollbar mb-5 overflow-x-auto border-b border-border pb-1">
                <TabsList className="flex w-max items-center h-auto p-0 bg-transparent gap-2">
                  {[
                    { id: "piutang", label: `Piutang (${piutangRows.length})` },
                    {
                      id: "pembayaran",
                      label: `Pembayaran (${payments.length})`,
                    },
                    {
                      id: "pengeluaran",
                      label: `Pengeluaran (${expenses.length})`,
                    },
                    {
                      id: "pembelian",
                      label: `Hutang Supplier (${purchases.filter((row) => row.balance > 0).length})`,
                    },
                    {
                      id: "pembayaranSupplier",
                      label: `Bayar Supplier (${supplierPayments.length})`,
                    },
                    {
                      id: "modal",
                      label: `Modal (${capitalTransactions.length})`,
                    },
                  ].map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                      <TabsTrigger
                        key={tab.id}
                        value={tab.id}
                        className={cn(
                          "relative flex items-center gap-2.5 rounded-t-[8px] px-4 py-3 text-sm font-semibold transition-all data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                          isActive
                            ? "text-[var(--amber-deep)] dark:text-[var(--amber-warm)]"
                            : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-hover)]",
                        )}
                      >
                        {tab.label}
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
                  value="piutang"
                  className="mt-0 outline-none animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  <PiutangTable
                    rows={piutangRows}
                    onTerimaPayment={handleTerimaPayment}
                  />
                </TabsContent>
                <TabsContent
                  value="pembayaran"
                  className="mt-0 outline-none animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  <PaymentTable rows={payments} onVoid={setSelectedPayment} />
                </TabsContent>
                <TabsContent
                  value="pengeluaran"
                  className="mt-0 outline-none animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  <ExpenseTable rows={expenses} onVoid={setSelectedExpense} />
                </TabsContent>
                <TabsContent
                  value="pembelian"
                  className="mt-0 outline-none animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  <PurchaseTable
                    rows={purchases}
                    onVoid={setSelectedPurchase}
                    onPay={setSupplierPaymentPurchase}
                  />
                </TabsContent>
                <TabsContent
                  value="pembayaranSupplier"
                  className="mt-0 outline-none animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  <SupplierPaymentTable
                    rows={supplierPayments}
                    onVoid={setSelectedSupplierPayment}
                  />
                </TabsContent>
                <TabsContent
                  value="modal"
                  className="mt-0 outline-none animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  <div className="space-y-4">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-700">Modal Disetor</p>
                        <p className="text-lg font-bold text-emerald-800 mt-1">{formatRupiah(capitalSummary.totalInitial + capitalSummary.totalInjections)}</p>
                        {capitalSummary.totalInjections > 0 && <p className="text-[10px] text-emerald-600 mt-0.5">+{formatRupiah(capitalSummary.totalInjections)} tambahan</p>}
                      </div>
                      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-amber-700">Prive & Bagi Hasil</p>
                        <p className="text-lg font-bold text-amber-800 mt-1">{formatRupiah(capitalSummary.totalWithdrawals + capitalSummary.totalDividends)}</p>
                      </div>
                      <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-blue-700">Modal Bersih</p>
                        <p className="text-lg font-bold text-blue-800 mt-1">{formatRupiah(capitalSummary.netCapital)}</p>
                      </div>
                      <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-4">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-stone-700">Total Transaksi</p>
                        <p className="text-lg font-bold text-stone-800 mt-1">{capitalSummary.count} mutasi</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setCapitalDialogType("INJECTION")}
                      >
                        <Plus size={14} />
                        Tambah Modal
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setCapitalDialogType("WITHDRAWAL")}
                      >
                        <HandCoins size={14} />
                        Catat Prive
                      </Button>
                    </div>

                    {/* Table */}
                    <CapitalTable rows={capitalTransactions} />
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </div>

      <TerimaPaymentDialog
        invoice={selectedInvoice}
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setSelectedInvoice(null);
        }}
        onSuccess={() => {
          setDialogOpen(false);
          setSelectedInvoice(null);
        }}
      />
      <CatatModalDialog
        type={capitalDialogType || "INJECTION"}
        open={Boolean(capitalDialogType)}
        onOpenChange={(v) => { if (!v) setCapitalDialogType(null); }}
        onSuccess={() => {
          setCapitalDialogType(null);
          window.location.reload();
        }}
      />
      <CatatPengeluaranDrawer
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
      />
      <SupplierPaymentDialog
        purchase={supplierPaymentPurchase}
        open={Boolean(supplierPaymentPurchase)}
        onOpenChange={(open) => {
          if (!open) setSupplierPaymentPurchase(null);
        }}
        onSuccess={() => setSupplierPaymentPurchase(null)}
      />

      <VoidConfirmDialog
        open={Boolean(selectedPurchase)}
        onOpenChange={(o) => {
          if (!o) setSelectedPurchase(null);
        }}
        title="Void Pembelian"
        description={`Stok dan biaya ${selectedPurchase?.code ?? ""} akan dibalik. Pembayaran supplier harus di-void lebih dahulu dan proses ditolak bila stok sudah digunakan.`}
        onConfirm={(reason) =>
          selectedPurchase
            ? voidPurchase(selectedPurchase.id, reason)
            : Promise.resolve({
                success: false,
                error: "Pembelian tidak dipilih.",
              })
        }
      />
      <VoidConfirmDialog
        open={Boolean(selectedPayment)}
        onOpenChange={(o) => {
          if (!o) setSelectedPayment(null);
        }}
        title="Void Pembayaran"
        description={`Pembayaran ${selectedPayment?.code ?? ""} akan dibatalkan dan invoice terkait kembali menjadi piutang.`}
        onConfirm={(reason) =>
          selectedPayment
            ? voidPayment(selectedPayment.id, reason)
            : Promise.resolve({
                success: false,
                error: "Pembayaran tidak dipilih.",
              })
        }
      />
      <VoidConfirmDialog
        open={Boolean(selectedSupplierPayment)}
        onOpenChange={(o) => {
          if (!o) setSelectedSupplierPayment(null);
        }}
        title="Void Pembayaran Supplier"
        description={`Pembayaran ${selectedSupplierPayment?.code ?? ""} akan dibatalkan dan saldo hutang pembelian terkait dipulihkan.`}
        onConfirm={(reason) =>
          selectedSupplierPayment
            ? voidSupplierPayment(selectedSupplierPayment.id, reason)
            : Promise.resolve({
                success: false,
                error: "Pembayaran supplier tidak dipilih.",
              })
        }
      />
      <VoidConfirmDialog
        open={Boolean(selectedExpense)}
        onOpenChange={(o) => {
          if (!o) setSelectedExpense(null);
        }}
        title="Void Pengeluaran"
        description="Pengeluaran akan dikeluarkan dari perhitungan arus kas dan Laba/Rugi, tetapi histori audit tetap tersimpan."
        onConfirm={(reason) =>
          selectedExpense
            ? voidExpense(selectedExpense.id, reason)
            : Promise.resolve({
                success: false,
                error: "Pengeluaran tidak dipilih.",
              })
        }
      />
    </>
  );
}
