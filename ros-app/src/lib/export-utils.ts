/**
 * Shared export utilities for PDF and Excel generation.
 * Professional-grade output for Roastd Studio reports.
 *
 * PDF: jsPDF + jspdf-autotable
 * Excel: ExcelJS (styled workbooks)
 */

// =============================================================================
// TYPES
// =============================================================================

export type ExportColumn<T> = {
  header: string;
  accessor: (row: T) => string | number | null;
  width?: number;
  align?: "left" | "center" | "right";
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
  /** Orientasi halaman PDF; gunakan "landscape" untuk tabel lebar (mis. 10-kolom). */
  orientation?: "portrait" | "landscape";
  summary?: { label: string; value: string }[];
  sections?: {
    title: string;
    columns: ExportColumn<unknown>[];
    data: unknown[];
  }[];
};

// =============================================================================
// BRAND COLORS
// =============================================================================

const BRAND = {
  primary:     [82,  47,  26]  as [number, number, number], // #521F1A — kopi gelap
  primaryLight:[180, 120, 80]  as [number, number, number], // moka terang
  dark:        [28,  22,  17]  as [number, number, number], // hitam kopi
  muted:       [120, 113, 108] as [number, number, number], // stone-500
  light:       [250, 246, 240] as [number, number, number], // krem hangat
  positive:    [21,  128, 61]  as [number, number, number], // emerald-700
  negative:    [185, 28,  28]  as [number, number, number], // red-700
  border:      [220, 210, 200] as [number, number, number], // stone-300
  white:       [255, 255, 255] as [number, number, number],
};

// =============================================================================
// HELPERS
// =============================================================================

function formatTimestamp(date = new Date()): string {
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatNumberForExport(val: string | number | null): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "number") return new Intl.NumberFormat("id-ID").format(val);
  return String(val);
}

// =============================================================================
// PDF EXPORT — PROFESSIONAL
// =============================================================================

/**
 * Generate and download a professional PDF report.
 * Features: cover page, branded header/footer, styled table, summary box.
 */
export async function exportToProfessionalPdf<T>(
  config: ProfessionalExportConfig<T>,
): Promise<void> {
  const { jsPDF }         = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc       = new jsPDF({ orientation: config.orientation ?? "portrait", unit: "mm", format: "a4" });
  const pageW     = doc.internal.pageSize.getWidth();
  const pageH     = doc.internal.pageSize.getHeight();
  const margin    = 16;
  const now       = new Date();
  const timestamp = formatTimestamp(now);
  const brand     = config.generatedBy || "Roastd Studio";

  // ─────────────────────────────────────────────────
  // COVER PAGE
  // ─────────────────────────────────────────────────

  // Top accent bar
  doc.setFillColor(...BRAND.primary);
  doc.rect(0, 0, pageW, 10, "F");

  // Brand wordmark on top bar
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND.white);
  doc.text("ROASTD STUDIO", margin, 6.5);

  // Status badge (top right)
  if (config.status) {
    const badgeBg: [number, number, number] =
      config.status === "FINAL" ? [21, 128, 61] : [180, 100, 10];
    doc.setFillColor(...badgeBg);
    doc.roundedRect(pageW - margin - 24, 2.5, 22, 6, 1.5, 1.5, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND.white);
    doc.text(config.status, pageW - margin - 13, 6.5, { align: "center" });
  }

  // Main title
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND.dark);
  doc.text(config.title, margin, 38);

  // Subtitle
  if (config.subtitle) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND.muted);
    doc.text(config.subtitle, margin, 48);
  }

  // Period pill
  if (config.period) {
    const pillY = config.subtitle ? 58 : 50;
    doc.setFillColor(...BRAND.light);
    doc.setDrawColor(...BRAND.border);
    doc.roundedRect(margin, pillY - 4.5, 80, 7.5, 2, 2, "FD");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND.primary);
    doc.text(`📅  Periode: ${config.period}`, margin + 4, pillY + 0.8);
  }

  // Horizontal rule
  const ruleY = config.subtitle ? 74 : 66;
  doc.setDrawColor(...BRAND.border);
  doc.setLineWidth(0.4);
  doc.line(margin, ruleY, pageW - margin, ruleY);

  // Executive Summary box
  if (config.summary && config.summary.length > 0) {
    const boxY = ruleY + 8;
    const boxH = 12 + config.summary.length * 8;

    // Box background
    doc.setFillColor(...BRAND.light);
    doc.setDrawColor(...BRAND.border);
    doc.roundedRect(margin, boxY, pageW - margin * 2, boxH, 3, 3, "FD");

    // Box header
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND.muted);
    doc.text("RINGKASAN EKSEKUTIF", margin + 5, boxY + 7);

    // Two-column summary items
    const col1X = margin + 5;
    const col2X = pageW / 2 + 5;
    let itemY   = boxY + 15;

    config.summary.forEach((item, idx) => {
      const x = idx % 2 === 0 ? col1X : col2X;
      if (idx % 2 === 0 && idx > 0) itemY += 8;

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...BRAND.muted);
      doc.text(item.label, x, itemY);

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BRAND.dark);
      doc.text(item.value, x, itemY + 4.5);
    });
  }

  // Cover footer
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BRAND.muted);
  doc.text(`Dibuat: ${timestamp}`, margin, pageH - 12);
  doc.text(brand, pageW - margin, pageH - 12, { align: "right" });

  // Bottom accent bar
  doc.setFillColor(...BRAND.primary);
  doc.rect(0, pageH - 5, pageW, 5, "F");

  // ─────────────────────────────────────────────────
  // DATA PAGE(S)
  // ─────────────────────────────────────────────────

  const drawPageHeader = () => {
    doc.setFillColor(...BRAND.primary);
    doc.rect(0, 0, pageW, 8, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND.white);
    doc.text("ROASTD STUDIO", margin, 5.5);
    doc.setFont("helvetica", "normal");
    doc.text(config.title.toUpperCase(), pageW / 2, 5.5, { align: "center" });
    if (config.period) doc.text(config.period, pageW - margin, 5.5, { align: "right" });
  };

  const drawPageFooter = (pageNumber: number, totalPages: number) => {
    doc.setFillColor(...BRAND.light);
    doc.rect(0, pageH - 8, pageW, 8, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND.muted);
    doc.text(`Halaman ${pageNumber} dari ${totalPages}`, pageW / 2, pageH - 3, { align: "center" });
    doc.text(brand, margin, pageH - 3);
    doc.text(timestamp, pageW - margin, pageH - 3, { align: "right" });
  };

  // Determine sections to render
  const allSections: { title?: string; columns: ExportColumn<unknown>[]; data: unknown[] }[] = [];
  if (config.sections && config.sections.length > 0) {
    allSections.push(...config.sections);
  } else {
    allSections.push({
      columns: config.columns as ExportColumn<unknown>[],
      data: config.data as unknown[],
    });
  }

  let isFirstSection = true;

  for (const section of allSections) {
    if (isFirstSection) {
      doc.addPage();
      drawPageHeader();
      isFirstSection = false;
    } else {
      // Section title on same page if possible
    }

    // Section label
    let startY = 14;
    if (section.title) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BRAND.dark);
      const lastTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
      if (lastTable) {
        startY = lastTable.finalY + 10;
        doc.text(section.title.toUpperCase(), margin, startY - 3);
        startY += 2;
      } else {
        doc.text(section.title.toUpperCase(), margin, startY);
        startY += 5;
      }
    }

    const headers = section.columns.map((col) => col.header);
    const rows = (section.data as Record<string, unknown>[]).map((row) =>
      section.columns.map((col) => {
        const val = (col as ExportColumn<Record<string, unknown>>).accessor(row);
        return formatNumberForExport(val);
      })
    );

    // Determine column alignments
    const columnStyles: Record<number, { halign?: "left" | "center" | "right" }> = {};
    section.columns.forEach((col, i) => {
      if (col.align) {
        columnStyles[i] = { halign: col.align };
      } else if (
        col.header.match(/Jumlah|Nilai|Harga|Amount|Revenue|Profit|Nominal|Total|Biaya|HPP|Rp/i)
      ) {
        columnStyles[i] = { halign: "right" };
      } else if (col.header.match(/Qty|Unit|Volume|Pcs|Kg/i)) {
        columnStyles[i] = { halign: "center" };
      }
    });

    autoTable(doc, {
      head: [headers],
      body: rows.length > 0 ? rows : [Array(headers.length).fill("— Tidak ada data —")],
      startY: section.title && (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
        ? startY
        : 14,
      margin: { top: 12, left: margin, right: margin, bottom: 12 },
      styles: {
        fontSize: 8,
        cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
        lineColor: BRAND.border,
        lineWidth: 0.2,
        textColor: BRAND.dark,
        font: "helvetica",
      },
      headStyles: {
        fillColor: BRAND.primary,
        textColor: BRAND.white,
        fontStyle: "bold",
        fontSize: 8,
        halign: "left",
        cellPadding: { top: 4, right: 4, bottom: 4, left: 4 },
      },
      alternateRowStyles: {
        fillColor: BRAND.light,
      },
      columnStyles,
      didDrawPage: (hookData) => {
        // Re-draw header on every page (always, the cover is page 1)
        drawPageHeader();
        // Footer on every page
        const totalPages = doc.getNumberOfPages();
        drawPageFooter(hookData.pageNumber, totalPages);
      },
    });
  }

  // Update all footers with final page count
  const totalPages = doc.getNumberOfPages();
  for (let p = 2; p <= totalPages; p++) {
    doc.setPage(p);
    drawPageFooter(p, totalPages);
  }

  doc.save(config.filename.endsWith(".pdf") ? config.filename : `${config.filename}.pdf`);
}

// =============================================================================
// PDF EXPORT — BASIC (fallback)
// =============================================================================

export async function exportToPdf<T>(config: ExportConfig<T>): Promise<void> {
  return exportToProfessionalPdf(config);
}

// =============================================================================
// EXCEL EXPORT — PROFESSIONAL (ExcelJS)
// =============================================================================

/**
 * Generate and download a professional styled Excel workbook.
 * Requires ExcelJS. Features: colored headers, auto-fit, summary sheet, Rupiah format.
 */
export async function exportToProfessionalExcel<T>(
  config: ProfessionalExportConfig<T>,
): Promise<void> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();

  workbook.creator   = config.generatedBy || "Roastd Studio";
  workbook.lastModifiedBy = config.generatedBy || "Roastd Studio";
  workbook.created   = new Date();
  workbook.modified  = new Date();

  const brandColor    = "52211A"; // BRAND.primary as hex
  const headerTextHex = "FFFFFF";
  const altRowColor   = "FAF6F0"; // BRAND.light as hex
  const borderColor   = { argb: "FFDCD2C8" };
  const thinBorder    = { style: "thin" as const, color: borderColor };

  // ─── SUMMARY SHEET ────────────────────────────────────────────────────
  if (config.summary && config.summary.length > 0) {
    const ws = workbook.addWorksheet("Ringkasan");
    ws.pageSetup = { fitToPage: true, fitToWidth: 1 };

    // Brand header row
    ws.mergeCells("A1:D1");
    const brandCell = ws.getCell("A1");
    brandCell.value = "ROASTD STUDIO";
    brandCell.font  = { bold: true, color: { argb: headerTextHex }, size: 14 };
    brandCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: brandColor } };
    brandCell.alignment = { horizontal: "left", vertical: "middle" };
    ws.getRow(1).height = 28;

    // Title
    ws.mergeCells("A2:D2");
    const titleCell = ws.getCell("A2");
    titleCell.value = config.title;
    titleCell.font  = { bold: true, size: 16, color: { argb: "1C1611" } };
    titleCell.alignment = { horizontal: "left", vertical: "middle" };
    ws.getRow(2).height = 24;

    // Subtitle + period
    if (config.subtitle || config.period) {
      ws.mergeCells("A3:D3");
      const subCell = ws.getCell("A3");
      subCell.value = [config.subtitle, config.period].filter(Boolean).join("  ·  ");
      subCell.font  = { italic: true, size: 10, color: { argb: "786F6C" } };
      subCell.alignment = { horizontal: "left", vertical: "middle" };
      ws.getRow(3).height = 18;
    }

    ws.addRow([]); // spacer

    // Summary header
    const sumHeaderRow = ws.addRow(["RINGKASAN EKSEKUTIF", ""]);
    sumHeaderRow.getCell(1).font = { bold: true, size: 9, color: { argb: "786F6C" } };
    ws.getRow(sumHeaderRow.number).height = 16;

    // Summary data
    config.summary.forEach((item) => {
      const row = ws.addRow([item.label, item.value]);
      row.getCell(1).font = { size: 10, color: { argb: "786F6C" } };
      row.getCell(2).font = { bold: true, size: 11, color: { argb: "1C1611" } };
      row.getCell(2).alignment = { horizontal: "left" };
      ws.getRow(row.number).height = 18;
    });

    ws.addRow([]); // spacer

    // Timestamp
    const tsRow = ws.addRow([`Dibuat: ${formatTimestamp()}`]);
    tsRow.getCell(1).font = { italic: true, size: 8, color: { argb: "786F6C" } };

    ws.getColumn(1).width = 35;
    ws.getColumn(2).width = 30;
  }

  // ─── DATA SHEET ───────────────────────────────────────────────────────
  const ws = workbook.addWorksheet(
    config.sheetName.length > 31 ? config.sheetName.slice(0, 31) : config.sheetName
  );
  ws.pageSetup = { fitToPage: true, fitToWidth: 1, orientation: "landscape" };
  ws.views     = [{ state: "frozen", ySplit: 2 }];

  // Top brand row
  ws.mergeCells(`A1:${String.fromCharCode(64 + config.columns.length)}1`);
  const topCell = ws.getCell("A1");
  topCell.value = `ROASTD STUDIO  ·  ${config.title}${config.period ? `  ·  ${config.period}` : ""}`;
  topCell.font  = { bold: true, color: { argb: headerTextHex }, size: 9 };
  topCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: brandColor } };
  topCell.alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(1).height = 22;

  // Column headers
  const headerRow = ws.addRow(config.columns.map((c) => c.header));
  headerRow.eachCell((cell) => {
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "3D1C14" } };
    cell.font      = { bold: true, color: { argb: headerTextHex }, size: 9 };
    cell.border    = { bottom: thinBorder, right: thinBorder };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  ws.getRow(2).height = 20;

  // Data rows
  const dataRows = (config.data as Record<string, unknown>[]).map((row) =>
    config.columns.map((col) => (col as ExportColumn<Record<string, unknown>>).accessor(row))
  );

  dataRows.forEach((rowData, rowIdx) => {
    const row = ws.addRow(rowData);
    const isAlt = rowIdx % 2 === 1;

    row.eachCell({ includeEmpty: true }, (cell, colIdx) => {
      const col = config.columns[colIdx - 1];
      const val = rowData[colIdx - 1];

      // Background alternating
      if (isAlt) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: altRowColor } };
      }

      // Number formatting
      if (typeof val === "number") {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: "right", vertical: "middle" };
      } else {
        cell.alignment = { vertical: "middle" };
      }

      // Column-level alignment override
      if (col?.align === "right" || col?.header.match(/Jumlah|Nilai|Harga|Amount|Revenue|Profit|Nominal|Total|Biaya|HPP|Rp/i)) {
        cell.alignment = { horizontal: "right", vertical: "middle" };
      } else if (col?.align === "center") {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      }

      cell.border = { bottom: { style: "hair", color: borderColor }, right: { style: "hair", color: borderColor } };
    });

    ws.getRow(row.number).height = 16;
  });

  // No-data row
  if (dataRows.length === 0) {
    const emptyRow = ws.addRow(["Tidak ada data untuk ditampilkan."]);
    emptyRow.getCell(1).font = { italic: true, color: { argb: "786F6C" } };
    ws.mergeCells(`A3:${String.fromCharCode(64 + config.columns.length)}3`);
  }

  // Auto-fit columns
  config.columns.forEach((col, idx) => {
    const colLetter = ws.getColumn(idx + 1);
    const maxLen = Math.max(
      col.header.length,
      ...dataRows.map((row) => String(row[idx] ?? "").length),
    );
    colLetter.width = Math.min(Math.max(maxLen + 4, 12), 45);
  });

  // Write to browser download
  const buf    = await workbook.xlsx.writeBuffer();
  const blob   = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement("a");
  a.href       = url;
  a.download   = config.filename.endsWith(".xlsx") ? config.filename : `${config.filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// =============================================================================
// EXCEL EXPORT — BASIC (fallback, same as professional)
// =============================================================================

export async function exportToExcel<T>(config: ExportConfig<T>): Promise<void> {
  return exportToProfessionalExcel(config);
}

// =============================================================================
// CONVENIENCE HELPERS
// =============================================================================

export function createExportConfig<T>(
  title: string,
  filename: string,
  sheetName: string,
  columns: ExportColumn<T>[],
  data: T[],
): ExportConfig<T> {
  return { title, filename, sheetName, columns, data };
}

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
    sections?: { title: string; columns: ExportColumn<unknown>[]; data: unknown[] }[];
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
    generatedBy: "Roastd Studio",
  };
}

export function formatDateForExport(date: Date | string): string {
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTimeForExport(date: Date | string): string {
  return new Date(date).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
