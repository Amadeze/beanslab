"use client";

import { useState } from "react";
import { Upload } from "lucide-react";

export function PaymentProofForm({ endpoint, expectedAmount }: { endpoint: string; expectedAmount: number }) {
  const [payerName, setPayerName] = useState("");
  const [declaredAmount, setDeclaredAmount] = useState(String(expectedAmount));
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

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
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bukti pembayaran gagal dikirim.");
    } finally {
      setIsSending(false);
    }
  }

  const inputClass = "mt-1.5 w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200";
  return <section className="rounded-xl border border-stone-200 p-5"><h2 className="text-sm font-black uppercase tracking-wider">Kirim bukti pembayaran</h2><p className="mt-1 text-xs leading-5 text-stone-500">Isi nominal yang benar-benar ditransfer. Unggahan tidak otomatis melunasi invoice.</p><div className="mt-4 space-y-4"><label className="block text-xs font-semibold text-stone-600">Nama pemilik rekening / pengirim<input className={inputClass} value={payerName} onChange={(event) => setPayerName(event.target.value)} maxLength={120} /></label><label className="block text-xs font-semibold text-stone-600">Nominal yang ditransfer (Rp)<input className={inputClass} type="number" min="1" step="1" value={declaredAmount} onChange={(event) => setDeclaredAmount(event.target.value)} /></label><label className="block text-xs font-semibold text-stone-600">Nomor referensi opsional<input className={inputClass} value={reference} onChange={(event) => setReference(event.target.value)} maxLength={150} /></label><label className="block text-xs font-semibold text-stone-600">Foto bukti<span className="mt-1.5 flex min-h-24 cursor-pointer items-center justify-center rounded-lg border border-dashed border-stone-300 bg-stone-50 px-4 text-center text-sm text-stone-500"><Upload size={17} className="mr-2" />{file ? file.name : "Pilih JPG, PNG, atau WebP (maks. 5 MB)"}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] || null)} /></span></label>{message ? <p role="alert" className="text-sm text-red-700">{message}</p> : null}<button type="button" onClick={submit} disabled={isSending} className="w-full rounded-lg bg-[#B65331] px-4 py-3 text-sm font-black text-white disabled:opacity-50">{isSending ? "Mengirim..." : "Kirim untuk diverifikasi"}</button></div></section>;
}
