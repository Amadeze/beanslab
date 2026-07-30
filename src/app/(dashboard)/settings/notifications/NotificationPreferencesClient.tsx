"use client";

import { useState, useTransition } from "react";
import { Mail, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { upsertNotificationPreference } from "../notification-actions";

type Channel = "EMAIL" | "WHATSAPP";
type Event = "OVERDUE_INVOICE" | "PAYMENT_PROOF_SUBMITTED" | "PAYMENT_STATUS_UPDATED";

const EVENTS: Array<{ id: Event; label: string; description: string }> = [
  { id: "PAYMENT_PROOF_SUBMITTED", label: "Bukti bayar masuk", description: "Memberi tahu tim tenant saat pelanggan mengunggah bukti." },
  { id: "PAYMENT_STATUS_UPDATED", label: "Keputusan pembayaran", description: "Memberi tahu pelanggan ketika bukti disetujui atau ditolak." },
  { id: "OVERDUE_INVOICE", label: "Invoice jatuh tempo", description: "Mengingatkan pelanggan tentang tagihan yang melewati jatuh tempo." },
];
const CHANNELS: Array<{ id: Channel; label: string; icon: typeof Mail }> = [
  { id: "EMAIL", label: "Email", icon: Mail },
  { id: "WHATSAPP", label: "WhatsApp", icon: MessageCircle },
];

export function NotificationPreferencesClient({
  initial,
  configured,
}: {
  initial: Record<Event, Record<Channel, boolean>>;
  configured: Record<Channel, boolean>;
}) {
  const [values, setValues] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(event: Event, channel: Channel) {
    if (!configured[channel]) return;
    const previous = values[event][channel];
    const next = !previous;
    setValues((current) => ({ ...current, [event]: { ...current[event], [channel]: next } }));
    setMessage(null);
    startTransition(async () => {
      const result = await upsertNotificationPreference(channel, event, next);
      if (!result.success) {
        setValues((current) => ({ ...current, [event]: { ...current[event], [channel]: previous } }));
        setMessage(result.error ?? "Gagal menyimpan preferensi.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {CHANNELS.map((channel) => {
          const Icon = channel.icon;
          return <div key={channel.id} className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-3"><Icon size={17} /><span className="text-xs font-bold">{channel.label}</span><span className={cn("ml-auto rounded-full px-2 py-1 text-[9px] font-bold uppercase", configured[channel.id] ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>{configured[channel.id] ? "Provider siap" : "Belum dikonfigurasi"}</span></div>;
        })}
      </div>
      {EVENTS.map((event) => (
        <section key={event.id} className="rounded-xl border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-black text-stone-900">{event.label}</h2>
          <p className="mt-1 text-xs leading-5 text-stone-500">{event.description}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {CHANNELS.map((channel) => {
              const enabled = configured[channel.id] && values[event.id][channel.id];
              return <button key={channel.id} type="button" role="switch" aria-checked={enabled} disabled={isPending || !configured[channel.id]} onClick={() => toggle(event.id, channel.id)} className="flex items-center gap-3 rounded-lg border border-stone-200 px-3 py-2.5 text-left disabled:opacity-50"><span className="flex-1 text-xs font-bold text-stone-700">{channel.label}</span><span className={cn("relative h-6 w-10 rounded-full transition-colors", enabled ? "bg-emerald-600" : "bg-stone-300")}><span className={cn("absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform", enabled && "translate-x-4")} /></span></button>;
            })}
          </div>
        </section>
      ))}
      {message ? <p className="text-sm text-red-700" role="alert">{message}</p> : null}
    </div>
  );
}
