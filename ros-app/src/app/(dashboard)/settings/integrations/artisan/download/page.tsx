"use client";

import { Download, Monitor, CheckCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

export default function DownloadPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Download Roastd Studio"
        eyebrow="Pengaturan"
        description="Logger roast ringan berbasis Tauri dengan profil .alog kompatibel Artisan."
      />
      <div className="custom-scrollbar flex-1 overflow-auto">
        <div className="mx-auto max-w-[800px] p-4 md:p-6 lg:p-8">
          {/* Download Card */}
          <div className="glass-card rounded-2xl p-8 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--amber-warm)] to-amber-700 shadow-lg shadow-amber-500/20">
              <Monitor className="h-10 w-10 text-white" />
            </div>

            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
              Roastd Studio v0.10.2
            </h2>
            <p className="text-[var(--text-secondary)] mb-6 max-w-md mx-auto">
              Rekam kurva roast dan simpan setiap hasil sebagai profil .alog yang dapat dipakai kembali.
            </p>

            <a
              href="/downloads/RoastdStudio-0.10.2-x64-setup.exe"
              download
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--amber-warm)] px-8 py-3 text-sm font-bold text-white shadow-lg shadow-amber-500/20 hover:brightness-110 transition"
            >
              <Download size={18} />
              Download untuk Windows
            </a>

            <p className="mt-3 text-xs text-[var(--text-tertiary)]">
              Windows 10/11 (64-bit) · Tauri installer · 16,8 MB
            </p>
          </div>

          {/* Features */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <FeatureCard
              step="1"
              title="Install & Buka"
              desc="Jalankan installer sekali, lalu buka Roastd Studio."
            />
            <FeatureCard
              step="2"
              title="Login & Deteksi"
              desc="Login di browser; Studio lalu memindai koneksi USB/serial otomatis."
            />
            <FeatureCard
              step="3"
              title="Auto .alog"
              desc="Saat DROP, .alog, hasil timbang, stok, lot, dan batch disinkronkan otomatis."
            />
          </div>

          {/* Requirements */}
          <div className="mt-8 glass-card rounded-2xl p-6">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3">Persyaratan</h3>
            <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
              <li className="flex items-start gap-2">
                <CheckCircle size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                Windows 10 atau 11 (64-bit)
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                Mesin atau temperature reader USB/serial yang didukung; Artisan tetap opsional
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                Internet boleh terputus sementara; antrean dikirim ulang saat online
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ step, title, desc }: { step: string; title: string; desc: string }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--amber-warm)]/10 text-sm font-bold text-[var(--amber-warm)]">
        {step}
      </div>
      <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1">{title}</h3>
      <p className="text-xs text-[var(--text-secondary)]">{desc}</p>
    </div>
  );
}
