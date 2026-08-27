/**
 * Parse .alog filename to extract roast name and date.
 * 
 * Patterns:
 * - "Arabica-Gayo-Dark-2026-07-23.alog" → { name: "Arabica Gayo Dark", date: "2026-07-23" }
 * - "sweet-marias-ethiopia-dry-process.alog" → { name: "sweet-marias-ethiopia-dry-process", date: null }
 */
export function parseAlogFilename(filename: string): { name: string; date: string | null } {
  // Remove .alog extension
  const base = filename.replace(/\.alog$/i, "");

  // Try to extract date from end: pattern like "*-YYYY-MM-DD"
  const dateMatch = base.match(/^(.+)-(\d{4}-\d{2}-\d{2})$/);

  if (dateMatch) {
    const rawName = dateMatch[1];
    const date = dateMatch[2];
    // Convert hyphens to spaces, title case
    const name = rawName
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
    return { name, date };
  }

  // No date in filename - return as-is
  const name = base
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  return { name, date: null };
}
