"use client";
import { useEffect } from "react";

export function PrintTrigger() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("print") === "true") {
        setTimeout(() => window.print(), 500);
      }
    }
  }, []);
  return null;
}

export function PrintActionBar() {
  return (
    <div className="mb-8 flex items-center justify-between border-b border-white/10 bg-[#080B0C] p-3 text-white print:hidden">
      <button
        onClick={() => window.close()}
        className="min-h-10 px-3 text-sm font-medium text-white/60 transition-colors hover:bg-white/8 hover:text-white"
      >
        &larr; Tutup
      </button>
      <button
        onClick={() => window.print()}
        className="min-h-10 bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Cetak Nota
      </button>
    </div>
  );
}
