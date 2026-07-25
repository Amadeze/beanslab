"use client";

import { useEffect } from "react";
import { AlertTriangle, House, RefreshCcw } from "lucide-react";

interface RouteErrorStateProps {
  error: Error & { digest?: string };
  unstable_retry: () => void;
  homeHref?: string;
  homeLabel?: string;
  dark?: boolean;
}

export function RouteErrorState({
  error,
  unstable_retry,
  homeHref = "/",
  homeLabel = "Kembali ke Beranda",
  dark = false,
}: RouteErrorStateProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      className={`flex min-h-[70vh] items-center justify-center px-5 py-16 ${
        dark ? "bg-[#0e0c0a] text-white" : "bg-slate-50 text-slate-950"
      }`}
    >
      <div className="w-full max-w-lg text-center">
        <div
          className={`mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-lg border ${
            dark
              ? "border-red-400/20 bg-red-400/10 text-red-300"
              : "border-red-200 bg-red-50 text-red-600"
          }`}
        >
          <AlertTriangle size={28} aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold">Halaman gagal dimuat</h1>
        <p className={`mt-3 text-sm leading-6 ${dark ? "text-zinc-400" : "text-slate-600"}`}>
          Koneksi atau layanan data mungkin sedang terganggu. Coba lagi tanpa kehilangan sesi Anda.
        </p>
        {error.digest && (
          <p className={`mt-3 font-mono text-xs ${dark ? "text-zinc-500" : "text-slate-400"}`}>
            Referensi: {error.digest}
          </p>
        )}
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={unstable_retry}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[9px] bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <RefreshCcw size={16} aria-hidden="true" />
            Coba Lagi
          </button>
          <a
            href={homeHref}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-5 text-sm font-semibold transition-colors ${
              dark
                ? "border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            <House size={16} aria-hidden="true" />
            {homeLabel}
          </a>
        </div>
      </div>
    </main>
  );
}
