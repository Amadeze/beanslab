import { Truck } from "lucide-react";
import { getRajaOngkirIntegrationState } from "@/lib/shipping/platform-integration";
import { RajaOngkirSettingsClient } from "./_components/RajaOngkirSettingsClient";

export const dynamic = "force-dynamic";

export default async function RajaOngkirIntegrationPage() {
  const state = await getRajaOngkirIntegrationState();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-7 p-5 md:p-8">
      <div>
        <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-domain-roasting">
          <Truck size={13} /> Integrasi · Pengiriman
        </p>
        <h2 className="text-3xl font-black tracking-[-0.045em]">RajaOngkir</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Satu API Key RajaOngkir milik platform Roastd.id untuk seluruh tenant.
          Kunci dienkripsi saat disimpan dan tidak pernah ditampilkan terbuka.
        </p>
      </div>

      <RajaOngkirSettingsClient
        initial={{
          isConfigured: state.isConfigured,
          isActive: state.isActive,
          maskedKey: state.maskedKey,
          lastTestedAt: state.lastTestedAt ? state.lastTestedAt.toISOString() : null,
          connectionStatus: state.connectionStatus ?? null,
          lastConnectionError: state.lastConnectionError ?? null,
        }}
      />
    </div>
  );
}
