// =============================================================================
// LEGACY STOCK IMPORTER — PARSER
// =============================================================================
// Pure file parsing: CSV and XLSX → raw rows.
// No validation, no DB access. Easy to unit test.

import { parse as csvParse } from "csv-parse/sync";
import type { CellValue } from "exceljs";
import type { LegacyStockRawRow, ParseResult, ParseOptions } from "./types";

// ─── Constants ───
const DEFAULT_MAX_ROWS = 5000;
const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const REQUIRED_HEADERS = ["type", "code", "name", "quantity", "unitCost"] as const;
const ALLOWED_HEADERS = new Set([
  "type",
  "code",
  "name",
  "quantity",
  "unitcost",
  "category",
  "baseunit",
  "origin",
  "roastlevel",
  "netweightgrams",
  "capacitygrams",
  "tareweightgrams",
  "lotnumber",
  "receivedat",
  "expirydate",
  "suppliercode",
  "notes",
]);

// ─── Helpers ───
function detectFormat(buffer: Buffer, filename: string): "csv" | "xlsx" | "xls" {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "csv") return "csv";
  if (ext === "xlsx") return "xlsx";
  if (ext === "xls") return "xls";
  // Fallback: try to detect by content
  const header = buffer.slice(0, 4).toString("hex");
  if (header.startsWith("504b")) return "xlsx"; // PK zip header
  return "csv";
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "");
}

function validateHeaders(headers: string[]): string[] {
  const normalized = headers.map(normalizeHeader);
  const missing = REQUIRED_HEADERS.filter((h) => !normalized.includes(normalizeHeader(h)));
  if (missing.length > 0) {
    return [`Missing required columns: ${missing.join(", ")}`];
  }
  const unknown = normalized.filter((h) => h && !ALLOWED_HEADERS.has(h));
  if (unknown.length > 0) {
    return [`Unknown columns (will be ignored): ${unknown.join(", ")}`];
  }
  return [];
}

function parseCsvBuffer(buffer: Buffer, maxRows: number): LegacyStockRawRow[] {
  const text = buffer.toString("utf-8");
  const records = csvParse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
  });
  return records.slice(0, maxRows) as LegacyStockRawRow[];
}

function stringifyCellValue(value: CellValue): string | number {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date) return value.toISOString();
  if ("richText" in value) return value.richText.map((entry) => entry.text).join("");
  if ("hyperlink" in value) return value.text;
  if ("error" in value) return value.error;
  if ("result" in value) return stringifyCellValue(value.result);
  return "";
}

async function parseXlsxBuffer(buffer: Buffer, maxRows: number): Promise<LegacyStockRawRow[]> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = Uint8Array.from(buffer).buffer;
  await workbook.xlsx.load(arrayBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headerRow = worksheet.getRow(1);
  const headers = Array.from({ length: headerRow.cellCount }, (_, index) =>
    String(stringifyCellValue(headerRow.getCell(index + 1).value)),
  );
  const rows: LegacyStockRawRow[] = [];

  for (let rowNumber = 2; rowNumber <= worksheet.actualRowCount && rows.length < maxRows; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const record: Record<string, string | number> = {};
    let hasValue = false;
    headers.forEach((header, index) => {
      if (!header) return;
      const value = stringifyCellValue(row.getCell(index + 1).value);
      if (value !== "") hasValue = true;
      record[header] = value;
    });
    if (hasValue) rows.push(record as LegacyStockRawRow);
  }

  return rows;
}

// ─── Main Parser ───
export async function parseLegacyStockFile(
  buffer: Buffer,
  filename: string,
  options: ParseOptions = {}
): Promise<ParseResult> {
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;
  const maxFileSize = options.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE;
  const errors: string[] = [];

  if (buffer.length > maxFileSize) {
    errors.push(`File size ${buffer.length} bytes exceeds limit ${maxFileSize} bytes`);
    return { rawRows: [], errors, rowCount: 0 };
  }

  if (buffer.length === 0) {
    errors.push("Empty file");
    return { rawRows: [], errors, rowCount: 0 };
  }

  let rawRows: LegacyStockRawRow[];
  try {
    const format = detectFormat(buffer, filename);
    if (format === "csv") {
      rawRows = parseCsvBuffer(buffer, maxRows);
    } else if (format === "xls") {
      throw new Error("Format .xls lama tidak didukung. Simpan ulang sebagai .xlsx atau .csv.");
    } else {
      rawRows = await parseXlsxBuffer(buffer, maxRows);
    }
  } catch (err) {
    errors.push(`Parse error: ${err instanceof Error ? err.message : "Unknown error"}`);
    return { rawRows: [], errors, rowCount: 0 };
  }

  if (rawRows.length === 0) {
    errors.push("No data rows found");
    return { rawRows: [], errors, rowCount: 0 };
  }

  // Validate headers from first row
  const firstRowKeys = Object.keys(rawRows[0] ?? {});
  const headerErrors = validateHeaders(firstRowKeys);
  errors.push(...headerErrors);

  return { rawRows, errors, rowCount: rawRows.length };
}
