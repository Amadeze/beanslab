import { PageHeader } from "@/components/layout/PageHeader";
import { requireRole, requireTenantPrisma } from "@/lib/auth";
import { SettingsNav } from "../_components/SettingsNav";
import { saveCommerceSettings } from "./actions";

export const dynamic = "force-dynamic";

export default async function CommerceSettingsPage() {
  const user = await requireRole("OWNER");
  const tp = await requireTenantPrisma();
  const tenant = await tp.tenant.findUniqueOrThrow({
    where: { id: user.tenantId },
    select: {
      storefrontPickupEnabled: true, storefrontDeliveryEnabled: true,
      storefrontFlatShippingRate: true, storefrontFreeShippingMinimum: true,
      storefrontTaxRate: true, storefrontReservationMinutes: true,
    },
  });
  const inputClass = "mt-2 h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title="Toko & Pengiriman" eyebrow="Pengaturan" description="Atur ongkir, pajak, dan berapa lama stok ditahan saat pelanggan belum membayar." />
      <SettingsNav userRole={user.role} />
      <div className="custom-scrollbar flex-1 overflow-auto">
        <form action={saveCommerceSettings} className="mx-auto grid max-w-4xl gap-5 p-4 md:p-6 lg:p-8">
          <section className="rounded-xl border border-stone-200 bg-white p-5">
            <h2 className="text-sm font-black text-stone-900">Cara menerima pesanan</h2>
            <p className="mt-1 text-xs leading-5 text-stone-500">Minimal satu pilihan harus aktif. Ongkir dihitung oleh server, bukan dipercaya dari browser pelanggan.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-3 rounded-lg border border-stone-200 p-4 text-sm font-bold"><input name="pickupEnabled" type="checkbox" defaultChecked={tenant.storefrontPickupEnabled} className="size-4" /> Ambil di roastery</label>
              <label className="flex items-center gap-3 rounded-lg border border-stone-200 p-4 text-sm font-bold"><input name="deliveryEnabled" type="checkbox" defaultChecked={tenant.storefrontDeliveryEnabled} className="size-4" /> Pengiriman</label>
            </div>
          </section>
          <section className="grid gap-4 rounded-xl border border-stone-200 bg-white p-5 md:grid-cols-2">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-600">Ongkir tetap (Rp)<input className={inputClass} name="flatShippingRate" type="number" min="0" step="1000" defaultValue={Number(tenant.storefrontFlatShippingRate)} /></label>
            <label className="text-xs font-bold uppercase tracking-wider text-stone-600">Gratis ongkir minimum (opsional)<input className={inputClass} name="freeShippingMinimum" type="number" min="0" step="1000" defaultValue={tenant.storefrontFreeShippingMinimum === null ? "" : Number(tenant.storefrontFreeShippingMinimum)} placeholder="Kosongkan jika tidak ada" /></label>
            <label className="text-xs font-bold uppercase tracking-wider text-stone-600">Pajak (%)<input className={inputClass} name="taxRate" type="number" min="0" max="100" step="0.01" defaultValue={Number(tenant.storefrontTaxRate)} /></label>
            <label className="text-xs font-bold uppercase tracking-wider text-stone-600">Tahan stok (menit)<input className={inputClass} name="reservationMinutes" type="number" min="15" max="10080" defaultValue={tenant.storefrontReservationMinutes} /><span className="mt-1 block normal-case font-normal text-stone-400">Contoh 1440 = 24 jam.</span></label>
          </section>
          <div className="flex justify-end"><button className="h-11 rounded-lg bg-stone-900 px-5 text-sm font-black text-white hover:bg-stone-800">Simpan pengaturan</button></div>
        </form>
      </div>
    </div>
  );
}
