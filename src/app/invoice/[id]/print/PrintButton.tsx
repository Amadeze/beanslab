"use client";
import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print flex min-h-10 items-center gap-2 bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
    >
      <Printer size={14} />
      Print / Simpan PDF
    </button>
  );
}
