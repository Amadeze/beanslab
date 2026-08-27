"use client";

import { useState } from "react";
import { Download, FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { exportToPdf, exportToExcel, exportToProfessionalPdf, exportToProfessionalExcel } from "@/lib/export-utils";

interface ReportExportColumn {
  header: string;
  key: string;
  width?: number;
  /** Formatter opsional per kolom (mis. formatRupiah, formatDate) supaya ekspor rapi. */
  format?: (value: unknown, row: Record<string, any>) => string | number | null;
}

/** Bagian laporan dengan judul & tabel sendiri (khusus PDF professional). */
interface ReportExportSection {
  title: string;
  columns: ReportExportColumn[];
  data: Record<string, any>[];
}

interface ReportExportProps {
  title: string;
  filename: string;
  columns: ReportExportColumn[];
  data: Record<string, any>[];
  className?: string;
  // Professional export options
  subtitle?: string;
  period?: string;
  status?: "DRAFT" | "FINAL";
  summary?: { label: string; value: string }[];
  useProfessional?: boolean;
  sections?: ReportExportSection[];
  /** Orientasi halaman PDF (default portrait). Gunakan "landscape" untuk tabel lebar. */
  orientation?: "portrait" | "landscape";
}

const toExportColumns = (columns: ReportExportColumn[]) =>
  columns.map((col) => ({
    header: col.header,
    accessor: (row: unknown) =>
      col.format
        ? col.format((row as Record<string, any>)[col.key], row as Record<string, any>)
        : ((row as Record<string, any>)[col.key] ?? null),
  }));

export function ReportExport({
  title,
  filename,
  columns,
  data,
  className,
  subtitle,
  period,
  status,
  summary,
  useProfessional = true,
  sections,
  orientation = "portrait",
}: ReportExportProps) {
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);

  const exportColumns = toExportColumns(columns);
  const exportSections = sections?.map((s) => ({
    title: s.title,
    columns: toExportColumns(s.columns),
    data: s.data,
  }));

  const handlePdf = async () => {
    setExporting("pdf");
    try {
      if (useProfessional) {
        await exportToProfessionalPdf({
          title,
          filename: `${filename}.pdf`,
          sheetName: title,
          columns: exportColumns,
          data,
          sections: exportSections,
          subtitle,
          period,
          status,
          summary,
          orientation,
          showHeader: true,
          showFooter: true,
          showPageNumbers: true,
          showTimestamp: true,
          generatedBy: "roastd.id",
        });
      } else {
        await exportToPdf({
          title,
          filename: `${filename}.pdf`,
          sheetName: title,
          columns: exportColumns,
          data,
        });
      }
      toast.success("PDF berhasil diunduh");
    } catch (error) {
      console.error("PDF export failed:", error);
      toast.error("Gagal mengekspor PDF");
    } finally {
      setExporting(null);
    }
  };

  const handleExcel = async () => {
    setExporting("excel");
    try {
      if (useProfessional) {
        await exportToProfessionalExcel({
          title,
          filename: `${filename}.xlsx`,
          sheetName: title,
          columns: exportColumns,
          data,
          subtitle,
          period,
          status,
          summary,
        });
      } else {
        await exportToExcel({
          title,
          filename: `${filename}.xlsx`,
          sheetName: title,
          columns: exportColumns,
          data,
        });
      }
      toast.success("Excel berhasil diunduh");
    } catch (error) {
      console.error("Excel export failed:", error);
      toast.error("Gagal mengekspor Excel");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button
        onClick={handlePdf}
        disabled={exporting !== null}
        className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-50"
      >
        {exporting === "pdf" ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <FileText size={12} />
        )}
        PDF
      </button>
      <button
        onClick={handleExcel}
        disabled={exporting !== null}
        className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-50"
      >
        {exporting === "excel" ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <FileSpreadsheet size={12} />
        )}
        Excel
      </button>
    </div>
  );
}
