"use client";

import { motion } from "framer-motion";
import { ArrowRight, Check, CreditCard, Loader2, Package, Settings2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { completeOnboarding } from "./actions";

export function OnboardingClient({ readiness }: { readiness: { activePaymentMethods: number; machines: number; products: number } }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const paymentReady = readiness.activePaymentMethods > 0;

  async function handleStart() {
    setLoading(true);
    setMessage(null);
    const result = await completeOnboarding();
    if (result.success) {
      router.push("/dashboard");
      router.refresh();
      return;
    }
    setMessage(result.error || "Panduan belum dapat diselesaikan.");
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#071015] p-4 text-stone-900 md:p-8">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-[#f6f3ee] shadow-2xl">
        <header className="border-b border-stone-200 px-6 py-7 md:px-9">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#B65331]">Setup awal roastd.id</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight md:text-3xl">Siapkan alur yang benar-benar dipakai</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">Satu hal wajib sebelum masuk: tentukan rekening atau QRIS roastery. Mesin dan produk boleh ditambahkan setelah dashboard terbuka.</p>
        </header>
        <div className="space-y-3 p-6 md:p-9">
          <Link href="/settings/payments" className={`flex items-center gap-4 rounded-xl border p-4 transition hover:-translate-y-0.5 ${paymentReady ? "border-emerald-200 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}>
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${paymentReady ? "bg-emerald-700 text-white" : "bg-amber-500 text-white"}`}>{paymentReady ? <Check size={20} /> : <CreditCard size={20} />}</span>
            <span className="min-w-0 flex-1"><strong className="block text-sm">Rekening / QRIS tenant</strong><span className="mt-1 block text-xs leading-5 text-stone-600">{paymentReady ? `${readiness.activePaymentMethods} metode aktif. Pembayaran portal siap menerima bukti.` : "Wajib: tambah minimal satu tujuan pembayaran aktif."}</span></span>
            <ArrowRight size={17} />
          </Link>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/settings/machines" className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-4 hover:border-stone-400"><Settings2 size={19} className="text-stone-500" /><span><strong className="block text-sm">Mesin roasting</strong><span className="text-xs text-stone-500">{readiness.machines} mesin aktif · opsional sekarang</span></span></Link>
            <Link href="/katalog" className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-4 hover:border-stone-400"><Package size={19} className="text-stone-500" /><span><strong className="block text-sm">Produk</strong><span className="text-xs text-stone-500">{readiness.products} produk aktif · bisa diisi nanti</span></span></Link>
          </div>
          {message ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{message}</p> : null}
          <button type="button" onClick={handleStart} disabled={loading || !paymentReady} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#B65331] font-bold text-white transition hover:bg-[#934126] disabled:cursor-not-allowed disabled:opacity-45">
            {loading ? <Loader2 className="size-5 animate-spin" /> : <>Masuk ke Dashboard <ArrowRight className="size-4" /></>}
          </button>
        </div>
      </motion.div>
    </main>
  );
}
