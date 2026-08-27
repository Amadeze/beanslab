"use client";

import { useState } from "react";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";
import { Edit2, X, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateTenantAdmin } from "../actions";
import type { Tenant, SubscriptionTier, SubscriptionStatus } from "@prisma/client";

interface EditTenantDialogProps {
  tenant: Pick<Tenant, "id" | "name" | "code" | "isActive" | "subscriptionTier" | "subscriptionStatus">;
}

export function EditTenantDialog({ tenant }: EditTenantDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [isActive, setIsActive] = useState(tenant.isActive);
  const [tier, setTier] = useState<SubscriptionTier>(tenant.subscriptionTier);
  const [status, setStatus] = useState<SubscriptionStatus>(tenant.subscriptionStatus);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await updateTenantAdmin({ 
        id: tenant.id, 
        isActive, 
        subscriptionTier: tier, 
        subscriptionStatus: status 
      });
      if (res.success) {
        toast.success(`Outlet ${tenant.name} updated successfully!`);
        setIsOpen(false);
      } else {
        toastSafe.error(res.error);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="flex size-10 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
        title="Edit Tenant"
      >
        <Edit2 size={16} />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#080B0C]/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-xl font-black">
            <Settings2 size={20} className="text-domain-roasting" /> Edit roastery
          </h2>
          <button onClick={() => setIsOpen(false)} aria-label="Tutup" className="flex size-11 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-5 sm:p-6">
          
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-bold">{tenant.name}</p>
              <p className="font-mono text-xs text-muted-foreground">{tenant.code}</p>
            </div>

            <div className="flex flex-col gap-1.5 pt-2">
              <label className="text-xs font-semibold">Account status</label>
              <select 
                value={isActive ? "true" : "false"} 
                onChange={(e) => setIsActive(e.target.value === "true")}
                className="h-11 w-full border border-input bg-white px-3 text-sm outline-none focus:border-primary"
              >
                <option value="true">Active</option>
                <option value="false">Inactive / Suspended</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5 pt-2">
              <label className="text-xs font-semibold">Subscription tier</label>
              <select 
                value={tier} 
                onChange={(e) => setTier(e.target.value as SubscriptionTier)}
                className="h-11 w-full border border-input bg-white px-3 text-sm outline-none focus:border-primary"
              >
                <option value="TRIAL">Trial</option>
                <option value="BASIC">Basic (Starter)</option>
                <option value="PRO">Pro (Professional)</option>
                <option value="ENTERPRISE">Enterprise (Scale)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5 pt-2">
              <label className="text-xs font-semibold">Subscription status</label>
              <select 
                value={status} 
                onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}
                className="h-11 w-full border border-input bg-white px-3 text-sm outline-none focus:border-primary"
              >
                <option value="ACTIVE">Active</option>
                <option value="PAST_DUE">Past Due</option>
                <option value="CANCELED">Canceled</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </div>
            
          </div>

          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <Button type="button" onClick={() => setIsOpen(false)} variant="ghost">Batal</Button>
            <Button type="submit" disabled={loading} className="px-6 font-bold">
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
