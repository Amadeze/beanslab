"use client";

import { useState, useEffect } from "react";
import { Upload, CheckCircle2, Loader2, X } from "lucide-react";

export function PaymentProofForm({ endpoint, expectedAmount }: { endpoint: string; expectedAmount: number }) {
  const [payerName, setPayerName] = useState("");
  const [declaredAmount, setDeclaredAmount] = useState(String(expectedAmount));
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [file]);

  async function submit() {
    const amount = Number(declaredAmount);
    if (!payerName || !file || !Number.isFinite(amount) || amount <= 0) return setMessage("Nama pengirim, nominal transfer, dan foto bukti wajib diisi.");
    setIsSending(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.set("payerName", payerName);
      formData.set("declaredAmount", String(amount));
      formData.set("reference", reference);
      formData.set("file", file);
      const response = await fetch(endpoint, { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Bukti pembayaran gagal dikirim.");
      setSuccess(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bukti pembayaran gagal dikirim.");
    } finally {
      setIsSending(false);
    }
  }

  if (success) {
    return (
      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircle2 size={48} className="mx-auto mb-4 text-emerald-500" />
        <h2 className="text-lg font-bold text-emerald-900">Bukti berhasil dikirim</h2>
        <p className="mt-2 text-sm leading-relaxed text-emerald-700">
          Bukti pembayaran berhasil dikirim. Roastery akan memverifikasi dalam 1×24 jam.
        </p>
      </section>
    );
  }

  const inputClass = "mt-1.5 w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-base outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200";

  return (
    <section className="rounded-xl border border-stone-200 p-5">
      <h2 className="text-sm font-black uppercase tracking-wider">Kirim bukti pembayaran</h2>
      <p className="mt-1 text-xs leading-5 text-stone-500">Isi nominal yang benar-benar ditransfer. Unggahan tidak otomatis melunasi invoice.</p>
      <div className="mt-4 space-y-4">
        <label className="block text-xs font-semibold text-stone-600">
          Nama pemilik rekening / pengirim
          <input className={inputClass} value={payerName} onChange={(event) => setPayerName(event.target.value)} maxLength={120} disabled={isSending} />
        </label>
        <label className="block text-xs font-semibold text-stone-600">
          Nominal yang ditransfer (Rp)
          <input className={inputClass} type="number" min="1" step="1" value={declaredAmount} onChange={(event) => setDeclaredAmount(event.target.value)} disabled={isSending} />
        </label>
        <label className="block text-xs font-semibold text-stone-600">
          Nomor referensi opsional
          <input className={inputClass} value={reference} onChange={(event) => setReference(event.target.value)} maxLength={150} disabled={isSending} />
        </label>
        <label className="block text-xs font-semibold text-stone-600">
          Foto bukti
          {previewUrl ? (
            <div className="relative mt-1.5 w-full overflow-hidden rounded-lg border border-stone-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Preview Bukti" className="max-h-64 w-full object-contain bg-stone-50" />
              {!isSending && (
                <button type="button" onClick={(e) => { e.preventDefault(); setFile(null); }} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70">
                  <X size={16} />
                </button>
              )}
              {isSending && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50">
                  <Loader2 className="animate-spin text-stone-900" size={32} />
                  <span className="mt-2 rounded bg-white px-2 py-1 text-xs font-bold text-stone-900">Mengunggah...</span>
                </div>
              )}
            </div>
          ) : (
            <span className="mt-1.5 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-stone-300 bg-stone-50 px-4 text-center text-sm text-stone-500 transition hover:bg-stone-100">
              <Upload size={24} className="mb-2 text-stone-400" />
              Pilih JPG, PNG, atau WebP (maks. 5 MB)
              <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] || null)} disabled={isSending} />
            </span>
          )}
        </label>
        {message ? <p role="alert" className="text-sm font-semibold text-red-600">{message}</p> : null}
        <button type="button" onClick={submit} disabled={isSending} className="w-full rounded-lg bg-[#B65331] px-4 py-3 text-sm font-black text-white transition-colors hover:bg-[#a04627] disabled:opacity-50">
          {isSending ? "Mengirim..." : "Kirim untuk diverifikasi"}
        </button>
      </div>
    </section>
  );
}
