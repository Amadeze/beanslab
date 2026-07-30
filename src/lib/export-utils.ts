/**
 * Shared export utilities for PDF and Excel generation.
 * Consolidates duplicate export logic from inventory and sales modules.
 */

// =============================================================================
// TYPES
// =============================================================================

export type ExportColumn<T> = {
  header: string;
  accessor: (row: T) => string | number | null;
};

export type ExportConfig<T> = {
  title: string;
  filename: string;
  sheetName: string;
  columns: ExportColumn<T>[];
  data: T[];
};

export type ProfessionalExportConfig<T> = ExportConfig<T> & {
  subtitle?: string;
  period?: string;
  generatedBy?: string;
  showHeader?: boolean;
  showFooter?: boolean;
  showPageNumbers?: boolean;
  showTimestamp?: boolean;
  status?: "DRAFT" | "FINAL";
  summary?: { label: string; value: string }[];
};

// =============================================================================
// PDF EXPORT (Basic)
// =============================================================================

/**
 * Generate and download a PDF file with tabular data.
 */
export async function exportToPdf<T>(config: ExportConfig<T>): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF();

  // Add title
  doc.text(config.title, 14, 15);

  // Prepare table data
  const headers = config.columns.map((col) => col.header);
  const rows = config.data.map((row) =>
    config.columns.map((col) => col.accessor(row) ?? "")
  );

  // Generate table
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 20,
  });

  // Save file
  doc.save(`${config.filename}.pdf`);
}

// =============================================================================
// PDF EXPORT (Professional)
// =============================================================================

/**
 * Generate and download a professional PDF report with cover page, header, footer, and page numbers.
 */
export async function exportToProfessionalPdf<T>(
  config: ProfessionalExportConfig<T>
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Colors
  const primaryColor: [number, number, number] = [0, 200, 223]; // #00C8DF
  const darkColor: [number, number, number] = [15, 23, 42]; // slate-900
  const mutedColor: [number, number, number] = [120, 113, 108]; // stone-500

  // ---- Cover Page ----
  // Header bar
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 8, "F");

  // Title
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkColor);
  doc.text(config.title, 20, 45);

  // Subtitle
  if (config.subtitle) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...mutedColor);
    doc.text(config.subtitle, 20, 55);
  }

  // Period
  if (config.period) {
    doc.setFontSize(11);
    doc.setTextColor(...mutedColor);
    doc.text(`Periode: ${config.period}`, 20, 68);
  }

  // Status badge
  if (config.status) {
    const badgeColor: [number, number, number] = config.status === "FINAL" ? [5, 150, 105] : [217, 119, 6];
    doc.setFillColor(...badgeColor);
    doc.roundedRect(20, 75, 25, 8, 2, 2, "F");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(config.status, 32.5, 80, { align: "center" });
  }

  // Summary table
  let summaryY = 100;
  if (config.summary && config.summary.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...darkColor);
    doc.text("Ringkasan", 20, summaryY);
    summaryY += 8;

    for (const item of config.summary) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...mutedColor);
      doc.text(item.label, 20, summaryY);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...darkColor);
      doc.text(item.value, 100, summaryY);
      summaryY += 7;
    }
  }

  // Footer on cover page
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...mutedColor);
  const now = new Date();
  const timestamp = now.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  doc.text(`Dibuat: ${timestamp}`, 20, pageHeight - 15);
  doc.text(config.generatedBy || "roastd.id", pageWidth - 20, pageHeight - 15, {
    align: "right",
  });

  // ---- Data Pages ----
  doc.addPage();

  // Page header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 6, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...mutedColor);
  doc.text(config.title, 14, 14);
  if (config.period) {
    doc.text(config.period, pageWidth - 14, 14, { align: "right" });
  }

  // Prepare table data
  const headers = config.columns.map((col) => col.header);
  const rows = config.data.map((row) =>
    config.columns.map((col) => {
      const val = col.accessor(row);
      if (val === null || val === undefined) return "";
      if (typeof val === "number") {
        return new Intl.NumberFormat("id-ID").format(val);
      }
      return String(val);
    })
  );

  // Generate table
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 20,
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: darkColor,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // stone-50
    },
    columnStyles: (() => {
      const styles: Record<number, { halign?: "left" | "center" | "right" }> = {};
      config.columns.forEach((col, index) => {
        if (col.header.includes("Jumlah") || col.header.includes("Nilai") ||
            col.header.includes("Harga") || col.header.includes("Amount") ||
            col.header.includes("Revenue") || col.header.includes("Profit")) {
          styles[index] = { halign: "right" };
        }
      });
      return styles;
    })(),
    margin: { top: 20, left: 14, right: 14 },
    didDrawPage: (data) => {
      // Footer on every page
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...mutedColor);

      // Page number
      if (config.showPageNumbers !== false) {
        const pageNum = doc.getNumberOfPages();
        doc.text(
          `Halaman ${data.pageNumber} dari ${pageNum}`,
          pageWidth / 2,
          pageHeight - 8,
          { align: "center" }
        );
      }

      // Footer text
      doc.text(
        `Dibuat oleh roastd.id · ${timestamp}`,
        14,
        pageHeight - 8
      );
    },
  });

  // Save file
  doc.save(`${config.filename}.pdf`);
}

// =============================================================================
// EXCEL EXPORT (Basic)
// =============================================================================

/**
 * Generate and download an Excel file with tabular data.
 */
export async function exportToExcel<T>(config: ExportConfig<T>): Promise<void> {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");

  // Prepare rows with headers
  const headers = config.columns.map((col) => col.header);
  const rows = config.data.map((row) =>
    config.columns.map((col) => col.accessor(row) ?? "")
  );

  await writeXlsxFile([headers, ...rows], {
    sheet: config.sheetName,
  }).toFile(`${config.filename}.xlsx`);
}

// =============================================================================
// EXCEL EXPORT (Professional)
// =============================================================================

/**
 * Generate and download a professional Excel report with summary sheet, header styling, and conditional formatting.
 */
export async function exportToProfessionalExcel<T>(
  config: ProfessionalExportConfig<T>
): Promise<void> {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");

  const sheets: { title: string; data: (string | number | boolean | Date | null | undefined)[][] }[] = [];

  // ---- Summary Sheet ----
  if (config.summary && config.summary.length > 0) {
    const summaryRows: (string | number | boolean | Date | null | undefined)[][] = [
      [config.title],
      [config.subtitle || ""],
      [config.period || ""],
      [""],
      ...config.summary.map((item) => [item.label, item.value]),
      [""],
      [`Dibuat: ${new Date().toLocaleDateString("id-ID")}`],
    ];
    sheets.push({ title: "Ringkasan", data: summaryRows });
  }

  // ---- Data Sheet ----
  const headers = config.columns.map((col) => col.header);
  const rows = config.data.map((row) =>
    config.columns.map((col) => col.accessor(row) ?? "")
  );
  sheets.push({ title: config.sheetName, data: [headers, ...rows] });

  // Write all sheets
  for (const sheet of sheets) {
    await writeXlsxFile(sheet.data, {
      sheet: sheet.title,
    }).toFile(`${config.filename}.xlsx`);
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Create an export configuration for simple data.
 */
export function createExportConfig<T>(
  title: string,
  filename: string,
  sheetName: string,
  columns: ExportColumn<T>[],
  data: T[],
): ExportConfig<T> {
  return { title, filename, sheetName, columns, data };
}

/**
 * Create a professional export configuration with summary.
 */
export function createProfessionalExportConfig<T>(
  title: string,
  filename: string,
  sheetName: string,
  columns: ExportColumn<T>[],
  data: T[],
  options?: {
    subtitle?: string;
    period?: string;
    status?: "DRAFT" | "FINAL";
    summary?: { label: string; value: string }[];
  },
): ProfessionalExportConfig<T> {
  return {
    title,
    filename,
    sheetName,
    columns,
    data,
    ...options,
    showHeader: true,
    showFooter: true,
    showPageNumbers: true,
    showTimestamp: true,
    generatedBy: "roastd.id",
  };
}

/**
 * Format a date for export (Indonesian locale).
 */
export function formatDateForExport(date: Date | string): string {
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format a datetime for export (Indonesian locale).
 */
export function formatDateTimeForExport(date: Date | string): string {
  return new Date(date).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
