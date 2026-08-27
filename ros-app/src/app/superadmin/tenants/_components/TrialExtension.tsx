"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { toastSafe } from "@/lib/toast";
import { extendTenantTrial } from "../actions";

export function TrialExtension({ tenantId }: { tenantId: string }) {
  const [days, setDays] = useState<7 | 14 | 30>(14);
  const [pending, setPending] = useState(false);

  async function extend() {
    setPending(true);
    try {
      const result = await extendTenantTrial({ tenantId, days });
      if (!result.success) {
        toastSafe.error(result.error);
        return;
      }
      toast.success(`Trial diperpanjang ${days} hari.`);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <select
        value={days}
        onChange={(event) => setDays(Number(event.target.value) as 7 | 14 | 30)}
        className="h-11 border border-input bg-card px-3 text-sm outline-none focus:border-primary"
        aria-label="Durasi perpanjangan trial"
      >
        <option value={7}>Tambah 7 hari</option>
        <option value={14}>Tambah 14 hari</option>
        <option value={30}>Tambah 30 hari</option>
      </select>
      <Button onClick={extend} disabled={pending} className="min-h-11 gap-2 font-bold">
        <CalendarPlus size={16} /> {pending ? "Memproses..." : "Perpanjang trial"}
      </Button>
    </div>
  );
}
