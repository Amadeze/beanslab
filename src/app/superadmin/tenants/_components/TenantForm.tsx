"use client";

import { useState } from "react";
import { createTenant } from "../actions";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";
import { Plus, X, Server, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TenantForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await createTenant({ code, name, subdomain, adminName, adminEmail });
      if (res.success) {
        toast.success(
          res.emailSent
            ? "Outlet berhasil dibuat. Tautan pembuatan password telah dikirim ke owner."
            : "Outlet berhasil dibuat. Konfigurasi email belum aktif; owner dapat memakai fitur lupa password setelah email diaktifkan.",
        );
        setIsOpen(false);
        setCode("");
        setName("");
        setSubdomain("");
        setAdminName("");
        setAdminEmail("");
      } else {
        toastSafe.error(res.error);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <Button 
        onClick={() => setIsOpen(true)} 
        className="flex min-h-11 items-center gap-2 px-5 font-bold"
      >
        <Plus size={18} /> New Outlet
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#080B0C]/75 p-4 backdrop-blur-sm">
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-xl font-black">
            <Server size={20} className="text-domain-roasting" /> Register new roastery
          </h2>
          <button onClick={() => setIsOpen(false)} aria-label="Tutup" className="flex size-11 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-5 sm:p-6">
          <div className="flex flex-col gap-4">
            <h3 className="flex items-center gap-2 border-b border-border pb-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              <Server size={14} /> Outlet Details
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold">Outlet code</label>
                <input 
                  type="text" required value={code} onChange={e => setCode(e.target.value)}
                  placeholder="e.g. NAL-001"
                  className="h-11 w-full border border-input bg-white px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold">Outlet name</label>
                <input 
                  type="text" required value={name} onChange={e => setName(e.target.value)}
                  placeholder="Kopi Timur Roastery"
                  className="h-11 w-full border border-input bg-white px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold">Subdomain</label>
              <div className="flex">
                <input 
                  type="text" required value={subdomain} onChange={e => setSubdomain(e.target.value)}
                  placeholder="kopitimur"
                  className="h-11 w-full min-w-0 border border-input border-r-0 bg-white px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
                />
                <div className="flex h-11 items-center border border-input bg-muted px-3 text-xs font-medium text-muted-foreground sm:px-4 sm:text-sm">
                  .localhost:3000
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="mt-2 flex items-center gap-2 border-b border-border pb-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              <UserIcon size={14} /> Owner Details
            </h3>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold">Admin name</label>
              <input 
                type="text" required value={adminName} onChange={e => setAdminName(e.target.value)}
                placeholder="Budi Santoso"
                className="h-11 w-full border border-input bg-white px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold">Admin email</label>
              <input 
                type="email" required value={adminEmail} onChange={e => setAdminEmail(e.target.value)}
                placeholder="owner@kopitimur.id"
                className="h-11 w-full border border-input bg-white px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
              />
            </div>
            <p className="border border-domain-production/20 bg-domain-production/8 p-3 text-xs font-medium text-domain-production">
              Owner akan menerima tautan aman untuk membuat password pertama. Tautan berlaku selama 24 jam.
            </p>
          </div>

          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <Button type="button" onClick={() => setIsOpen(false)} variant="ghost">Batal</Button>
            <Button type="submit" disabled={loading} className="px-6 font-bold">
              {loading ? "Creating..." : "Create Outlet"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
