"use client";

import { useState } from "react";
import { Calendar, TrendingUp, TrendingDown, ReceiptText, WalletCards } from "lucide-react";
import {
  ReportLayout,
  ReportKpiCard,
  ReportChart,
  ReportTable,
  ReportExport,
  ReportSkeleton,
  ReportError,
  useReportData,
  ReportHeader,
  type ReportColumn,
} from "../../_shared";
import { getSalesReport, getExpenseReport, getRoastingReport } from "../../actions";
import { formatRupiah } from "@/lib/format";

interface DailyActivity {
  time: string;
  area: string;
  activity: string;
  amount: number | null;
}

export default function DailyReportClient() {
  // Use local timezone for initial date (browser timezone, matches user expectation)
  const getLocalDateString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const { data, error, loading, retry } = useReportData(
    async () => {
      // Fetch daily data from multiple sources
      const [salesResult, expenseResult, roastingResult] = await Promise.all([
        getSalesReport(selectedDate, selectedDate),
        getExpenseReport(selectedDate, selectedDate),
        getRoastingReport(selectedDate, selectedDate),
      ]);

      const revenue = salesResult.totalRevenue;
      const expenses = expenseResult.totalExpenses;
      const transactions = salesResult.invoiceCount;
      const batches = roastingResult.totalBatches;

      // Combine activities from sales, expenses, and roasting
      const activities: DailyActivity[] = [
        ...salesResult.invoices.map((inv) => ({
          time: new Date(inv.date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
          area: "Penjualan",
          activity: `Invoice ${inv.code} - ${inv.customer}`,
          amount: inv.amount,
        })),
        ...expenseResult.expenses.map((exp) => ({
          time: new Date(exp.date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
          area: "Pengeluaran",
          activity: exp.description,
          amount: exp.amount,
        })),
        ...roastingResult.batches.map((batch) => ({
          time: new Date(batch.date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
          area: "Roasting",
          activity: `Roasting ${batch.gbInput}kg → ${batch.rbOutput}kg`,
          amount: null,
        })),
      ].sort((a, b) => a.time.localeCompare(b.time));

      return { revenue, expenses, transactions, batches, activities };
    },
    [selectedDate],
  );

  const columns: ReportColumn<DailyActivity>[] = [
    { key: "time", label: "Waktu", sortable: true },
    { key: "area", label: "Area", sortable: true },
    { key: "activity", label: "Aktivitas", sortable: true },
    {
      key: "amount",
      label: "Nilai",
      sortable: true,
      format: (v) => v ? formatRupiah(v) : "-",
      className: "text-right",
    },
  ];

  if (error) {
    return (
      <ReportLayout activeTab="daily">
        <ReportError message={error} onRetry={retry} />
      </ReportLayout>
    );
  }

  if (loading || !data) {
    return (
      <ReportLayout activeTab="daily">
        <ReportSkeleton />
      </ReportLayout>
    );
  }

  const dateLabel = new Date(selectedDate).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const operatingBalance = data.revenue - data.expenses;

  return (
    <ReportLayout
      activeTab="daily"
      actions={
        <ReportExport
          title={`Daily Report - ${selectedDate}`}
          filename={`daily-report-${selectedDate}`}
          columns={columns.map((c) => ({ header: c.label, key: c.key }))}
          data={data.activities}
        />
      }
    >
      <div className="space-y-6">
        <ReportHeader
          title="Laporan Harian"
          subtitle="Ringkasan aktivitas bisnis hari ini"
          period={dateLabel}
          generatedAt={new Date()}
        />

        {/* Date selector */}
        <div className="flex items-center gap-3">
          <Calendar size={16} className="text-stone-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-700 focus:border-[#00C8DF] focus:outline-none focus:ring-1 focus:ring-[#00C8DF]"
          />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <ReportKpiCard
            label="Revenue Hari Ini"
            value={formatRupiah(data.revenue)}
            icon={TrendingUp}
            color="emerald"
            help="Basis pendapatan: invoice diserahkan (deliveredAt) hari ini, dikurangi nilai retur."
          />
          <ReportKpiCard
            label="Pengeluaran"
            value={formatRupiah(data.expenses)}
            icon={WalletCards}
            color="rose"
            inverse
          />
          <ReportKpiCard
            label="Transaksi"
            value={data.transactions}
            subtitle="invoice lunas"
            icon={ReceiptText}
            color="blue"
            help="Jumlah nota yang diserahkan hari ini."
          />
          <ReportKpiCard
            label="Selisih Revenue − Beban"
            value={formatRupiah(operatingBalance)}
            icon={operatingBalance >= 0 ? TrendingUp : TrendingDown}
            color={operatingBalance >= 0 ? "emerald" : "rose"}
            help="Selisih revenue − pengeluaran hari ini. Bukan arus kas — lihat Laporan Arus Kas untuk pergerakan kas aktual (akun 1-1000)."
          />
        </div>

        {/* Executive Summary */}
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-500">Ringkasan Eksekutif</p>
          <div className="space-y-1 text-xs text-stone-600">
            <p>• Revenue hari ini: <span className="font-semibold">{formatRupiah(data.revenue)}</span> dari {data.transactions} transaksi</p>
            <p>• Pengeluaran: <span className="font-semibold">{formatRupiah(data.expenses)}</span></p>
            <p>• Selisih revenue − beban: <span className={`font-semibold ${operatingBalance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatRupiah(operatingBalance)}</span></p>
            {data.batches > 0 && <p>• Batch roasting selesai: <span className="font-semibold">{data.batches} batch</span></p>}
          </div>
        </div>

        {/* Chart */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ReportChart
            title="Revenue vs Expenses"
            type="bar"
            data={[
              { name: "Revenue", value: data.revenue },
              { name: "Expenses", value: data.expenses },
            ]}
            xKey="name"
            yKey="value"
          />
        </div>

        {/* Activity Table */}
        <ReportTable
          columns={columns}
          data={data.activities}
          pageSize={15}
          emptyMessage="Tidak ada aktivitas hari ini"
        />
      </div>
    </ReportLayout>
  );
}
