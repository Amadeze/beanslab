"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  KeyRound,
  LifeBuoy,
  Mail,
  MinusCircle,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { toastSafe } from "@/lib/toast";
import { sendTenantOwnerAccessLink, updateTenantMidtransSupport } from "../actions";

type SupportCheck = {
  label: string;
  detail: string;
  status: "ready" | "attention" | "off";
  href?: string;
};

export function TenantSupportConsole({
  tenantId,
  tenantName,
  ownerEmail,
  accessDeliveryReady,
  midtransClientConfigured,
  midtransServerConfigured,
  midtransIsProduction,
  checks,
  incidentCount,
}: {
  tenantId: string;
  tenantName: string;
  ownerEmail: string | null;
  accessDeliveryReady: boolean;
  midtransClientConfigured: boolean;
  midtransServerConfigured: boolean;
  midtransIsProduction: boolean;
  checks: SupportCheck[];
  incidentCount: number;
}) {
  const [clientKey, setClientKey] = useState("");
  const [serverKey, setServerKey] = useState("");
  const [isProduction, setIsProduction] = useState(midtransIsProduction);
  const [savingCredential, setSavingCredential] = useState(false);
  const [sendingAccess, setSendingAccess] = useState(false);
  const readyCount = checks.filter((check) => check.status === "ready").length;
  const offCount = checks.filter((check) => check.status === "off").length;

  async function saveMidtrans(event: React.FormEvent) {
    event.preventDefault();
    setSavingCredential(true);
    try {
      const result = await updateTenantMidtransSupport({
        tenantId,
        clientKey: clientKey.trim() || undefined,
        serverKey: serverKey.trim() || undefined,
        isProduction,
      });
      if (!result.success) {
        toastSafe.error(result.error);
        return;
      }
      setClientKey("");
      setServerKey("");
      toast.success("Credential Midtrans tenant diperbarui dan dicatat di audit.");
    } finally {
      setSavingCredential(false);
    }
  }

  async function sendAccessLink() {
    setSendingAccess(true);
    try {
      const result = await sendTenantOwnerAccessLink({ tenantId });
      if (!result.success) {
        toastSafe.error(result.error);
        return;
      }
      toast.success("Tautan akses 30 menit dikirim kepada owner.");
    } finally {
      setSendingAccess(false);
    }
  }

  return (
    <section aria-labelledby="tenant-support-title" className="overflow-hidden border border-border bg-card">
      <div className="grid bg-[#080B0C] text-white lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="p-5 md:p-6">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#67D8C8]"><LifeBuoy size={14} aria-hidden /> Tenant support console</p>
          <h2 id="tenant-support-title" className="mt-3 text-2xl font-black tracking-[-0.04em]">Bantu {tenantName} tanpa membuka data bisnisnya</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">Diagnosis konfigurasi, pemulihan akses, dan rotasi credential dilakukan per tenant serta selalu meninggalkan jejak audit.</p>
        </div>
        <div className={`m-5 flex min-h-11 items-center gap-2 px-4 text-sm font-bold lg:m-6 ${incidentCount ? "bg-amber-400/15 text-amber-200" : "bg-[#67D8C8]/12 text-[#87E4D6]"}`}>
          {incidentCount ? <CircleAlert size={17} aria-hidden /> : <ShieldCheck size={17} aria-hidden />}
          {incidentCount ? `${incidentCount} kegagalan · 7 hari` : "Tidak ada kegagalan 7 hari"}
        </div>
      </div>

      <div className="grid xl:grid-cols-[1.05fr_.95fr]">
        <div className="border-b border-border p-5 md:p-6 xl:border-b-0 xl:border-r">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Readiness tenant</p>
              <h3 className="mt-2 text-lg font-black">Apa yang perlu dibantu</h3>
            </div>
            <span className="font-mono text-xs text-muted-foreground">{readyCount} siap{offCount ? ` · ${offCount} nonaktif` : ""}</span>
          </div>
          <div className="divide-y divide-border border-y border-border">
            {checks.map((check) => (
              <div key={check.label} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-start gap-3 py-4">
                <span className={`mt-0.5 flex size-7 items-center justify-center ${check.status === "ready" ? "bg-domain-inventory/10 text-domain-inventory" : check.status === "attention" ? "bg-amber-500/10 text-amber-700" : "bg-muted text-muted-foreground"}`}>
                  {check.status === "ready" ? <CheckCircle2 size={15} aria-hidden /> : check.status === "off" ? <MinusCircle size={15} aria-hidden /> : <CircleAlert size={15} aria-hidden />}
                </span>
                <div>
                  <p className="text-sm font-bold">{check.label}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{check.detail}</p>
                </div>
                {check.href ? <Link href={check.href} aria-label={`Buka ${check.label}`} className="flex size-11 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowUpRight size={16} aria-hidden /></Link> : null}
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-3 border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-bold"><Mail size={15} aria-hidden /> Pulihkan akses owner</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{ownerEmail ?? "Owner aktif belum tersedia"}</p>
            </div>
            <Button type="button" variant="outline" onClick={sendAccessLink} disabled={!accessDeliveryReady || sendingAccess} className="min-h-11 shrink-0 font-bold">
              {sendingAccess ? "Mengirim…" : accessDeliveryReady ? "Kirim tautan akses" : "Email belum siap"}
            </Button>
          </div>
        </div>

        <form onSubmit={saveMidtrans} className="p-5 md:p-6">
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-domain-roasting"><KeyRound size={14} aria-hidden /> Bantuan integrasi</p>
          <h3 className="mt-2 text-lg font-black">Rotasi Midtrans storefront</h3>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">Input bersifat write-only. Credential lama tidak pernah dikirim kembali ke browser atau ditampilkan kepada superadmin.</p>

          <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
            <CredentialState label="Client Key" configured={midtransClientConfigured} />
            <CredentialState label="Server Key" configured={midtransServerConfigured} />
          </div>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold">Client Key baru</span>
              <input type="password" autoComplete="new-password" value={clientKey} onChange={(event) => setClientKey(event.target.value)} placeholder="Kosongkan jika tidak diganti" className="h-11 w-full border border-input bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold">Server Key baru</span>
              <input type="password" autoComplete="new-password" value={serverKey} onChange={(event) => setServerKey(event.target.value)} placeholder="Kosongkan jika tidak diganti" className="h-11 w-full border border-input bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
            </label>
            <label className="flex min-h-11 items-center justify-between gap-4 border border-border px-3">
              <span><span className="block text-xs font-bold">Environment Production</span><span className="mt-0.5 block text-xs text-muted-foreground">Perubahan mode wajib memakai pasangan key baru.</span></span>
              <input type="checkbox" checked={isProduction} onChange={(event) => setIsProduction(event.target.checked)} className="size-5 accent-domain-roasting" />
            </label>
          </div>

          <Button type="submit" disabled={savingCredential || (!clientKey.trim() && !serverKey.trim() && isProduction === midtransIsProduction)} className="mt-5 min-h-11 w-full font-bold">
            {savingCredential ? "Menyimpan…" : "Simpan credential baru"}
          </Button>
        </form>
      </div>
    </section>
  );
}

function CredentialState({ label, configured }: { label: string; configured: boolean }) {
  return (
    <div className="border border-border p-3">
      <p className="text-muted-foreground">{label}</p>
      <p className={`mt-1 font-bold ${configured ? "text-domain-inventory" : "text-amber-700"}`}>{configured ? "Tersimpan" : "Belum ada"}</p>
    </div>
  );
}
