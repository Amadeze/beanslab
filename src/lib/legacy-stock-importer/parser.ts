// =============================================================================
// LEGACY STOCK IMPORTER — PARSER
// =============================================================================
// Pure file parsing: CSV and XLSX → raw rows.
// No validation, no DB access. Easy to unit test.

import * as XLSX from "xlsx";
import { parse as csvParse } from "csv-parse/sync";
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
function detectFormat(buffer: Buffer, filename: string): "csv" | "xlsx" {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "csv") return "csv";
  if (ext === "xlsx" || ext === "xls") return "xlsx";
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

function parseXlsxBuffer(buffer: Buffer, maxRows: number): LegacyStockRawRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const worksheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(worksheet, {
    raw: false,
    defval: "",
    blankrows: false,
  });
  return json.slice(0, maxRows) as LegacyStockRawRow[];
}

// ─── Main Parser ───
export function parseLegacyStockFile(
  buffer: Buffer,
  filename: string,
  options: ParseOptions = {}
): ParseResult {
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
    } else {
      rawRows = parseXlsxBuffer(buffer, maxRows);
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