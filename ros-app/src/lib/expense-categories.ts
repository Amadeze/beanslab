/**
 * Sumber kebenaran kategori beban (2F.3).
 * Berada di modul non-"use server" agar dapat diekspor sebagai nilai
 * (Next.js melarang ekspor non-async dari file "use server").
 */

export const EXPENSE_CATEGORIES = [
  "UTILITAS",
  "OPERASIONAL",
  "LAINNYA",
  "GAJI",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];