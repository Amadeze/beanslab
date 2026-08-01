"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Bot, Loader2, Send, User } from "lucide-react";
import { StandardPageLayout } from "@/components/StandardPageLayout";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Input } from "@/components/ui/input";

interface Message {
  role: "user" | "assistant";
  content: string;
  data?: Record<string, unknown> | unknown[] | null;
  reportName?: string;
}

interface QuickPrompt {
  label: string;
  query: string;
}

const QUICK_PROMPTS: QuickPrompt[] = [
  { label: "Profit minggu ini", query: "Berapa profit minggu ini?" },
  { label: "Keuntungan bulan ini", query: "Berapa keuntungan bulan ini?" },
  { label: "Customer terbesar", query: "Siapa customer terbesar?" },
  { label: "Stok green bean rendah", query: "Green bean stok mau habis?" },
  { label: "Pembelian bulan ini", query: "Pembelian bulan ini" },
  { label: "Omzet hari ini", query: "Penjualan hari ini" },
];

const MONEY_KEYS = /amount|omzet|revenue|profit|cost|harga|total|nilai|pembelian|penjualan/i;

function formatDataValue(value: unknown, key = ""): string {
  if (typeof value === "number") {
    return MONEY_KEYS.test(key)
      ? new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          maximumFractionDigits: 0,
        }).format(value)
      : new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value);
  }
  if (value instanceof Date) {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(value);
  }
  return String(value);
}

export default function AiInsightsPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(query: string) {
    if (!query.trim()) return;
    setMessages((previous) => [...previous, { role: "user", content: query }]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal memproses pertanyaan.");
      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: data.answer, data: data.data, reportName: data.reportName },
      ]);
    } catch (caughtError: unknown) {
      const message = caughtError instanceof Error ? caughtError.message : "Terjadi kesalahan.";
      setError(message);
      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: "Laporan belum dapat dibaca. Coba ulangi pertanyaan Anda." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <StandardPageLayout
      title="Insight assistant"
      description="Tanyakan angka operasional dengan bahasa sehari-hari; jawaban berasal dari laporan Roastd."
    >
      <GlassPanel padding="none" className="mx-auto flex h-[calc(100dvh-165px)] min-h-[560px] w-full max-w-4xl flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b border-border/80 px-5 py-4">
          <div className="flex size-9 items-center justify-center rounded-[10px] border border-primary/20 bg-primary/10">
            <Bot className="size-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Tanya laporan</h2>
            <p className="text-xs text-muted-foreground">Query lokal · tidak mengubah data</p>
          </div>
          <span className="ml-auto rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Read only
          </span>
        </header>

        <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
          {messages.length === 0 && (
            <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center py-8">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Mulai dari laporan yang sering dipakai</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Angka operasional, tanpa bongkar menu.</h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                Pilih pertanyaan cepat atau ketik pertanyaan sendiri. Assistant hanya membaca laporan tenant Anda.
              </p>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <Button
                    key={prompt.query}
                    variant="outline"
                    className="h-auto justify-between rounded-[10px] px-3.5 py-3 text-left font-medium"
                    onClick={() => void sendMessage(prompt.query)}
                  >
                    {prompt.label}<ArrowUpRight className="size-4 text-muted-foreground" />
                  </Button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              {message.role === "assistant" && (
                <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="size-4 text-primary" />
                </div>
              )}
              <div className={`max-w-[88%] rounded-[12px] px-4 py-3 text-sm sm:max-w-[80%] ${message.role === "user" ? "bg-primary text-primary-foreground" : "border border-border bg-muted/45 text-foreground"}`}>
                <pre className="whitespace-pre-wrap font-sans leading-6">{message.content}</pre>
                {Array.isArray(message.data) && message.data.length > 0 ? (
                  <div className="mt-3 overflow-x-auto border-t border-border/60 pt-3">
                    <table className="w-full min-w-[420px] text-xs">
                      <thead><tr className="border-b text-muted-foreground">
                        {Object.keys(message.data[0] as Record<string, unknown>).map((key) => <th key={key} className="px-2 py-1.5 text-left font-medium">{key}</th>)}
                      </tr></thead>
                      <tbody>{(message.data as Record<string, unknown>[]).map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-b border-border/40 last:border-0">
                          {Object.entries(row).map(([key, value]) => <td key={key} className="px-2 py-1.5">{formatDataValue(value, key)}</td>)}
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : message.data && typeof message.data === "object" && !Array.isArray(message.data) ? (
                  <dl className="mt-3 space-y-1.5 border-t border-border/60 pt-3">
                    {Object.entries(message.data).map(([key, value]) => (
                      <div key={key} className="flex justify-between gap-6"><dt className="text-muted-foreground">{key}</dt><dd className="font-medium">{formatDataValue(value, key)}</dd></div>
                    ))}
                  </dl>
                ) : null}
              </div>
              {message.role === "user" && (
                <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <User className="size-4 text-secondary-foreground" />
                </div>
              )}
            </div>
          ))}

          {error && <p role="alert" className="text-center text-sm text-destructive">{error}</p>}
          {loading && <div className="flex items-center gap-3 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Membaca laporan…</div>}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2 border-t border-border/80 bg-card/70 p-3 sm:p-4">
          <Input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Contoh: berapa profit minggu ini?" disabled={loading} className="h-11 flex-1" aria-label="Pertanyaan laporan" />
          <Button type="submit" size="icon" className="size-11 shrink-0" disabled={loading || !input.trim()} aria-label="Kirim pertanyaan"><Send className="size-4" /></Button>
        </form>
      </GlassPanel>
    </StandardPageLayout>
  );
}
