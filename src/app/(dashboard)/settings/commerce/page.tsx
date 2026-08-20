import { PageHeader } from "@/components/layout/PageHeader";
import { requireRole, requireTenantPrisma } from "@/lib/auth";
import { SUPPORTED_COURIERS } from "@/lib/shipping/rajaongkir-config";
import { SettingsNav } from "../_components/SettingsNav";
import { OriginSearchPicker } from "./_components/OriginSearchPicker";
import { saveCommerceSettings } from "./actions";

export const dynamic = "force-dynamic";

export default async function CommerceSettingsPage() {
  const user = await requireRole("OWNER");
  const tp = await requireTenantPrisma();
  const tenant = await tp.tenant.findUniqueOrThrow({
    where: { id: user.tenantId },
    select: {
      storefrontPickupEnabled: true,
      storefrontDeliveryEnabled: true,
      storefrontFlatShippingRate: true,
      storefrontFreeShippingMinimum: true,
      storefrontTaxRate: true,
      storefrontReservationMinutes: true,
      nationalCourierEnabled: true,
      rajaOngkirOriginId: true,
      rajaOngkirOriginLabel: true,
      rajaOngkirOriginProvince: true,
      rajaOngkirOriginCity: true,
      rajaOngkirOriginDistrict: true,
      rajaOngkirOriginSubdistrict: true,
      rajaOngkirOriginPostalCode: true,
      rajaOngkirOriginStreet: true,
      rajaOngkirCourierCodes: true,
      rajaOngkirTareGrams: true,
    },
  });
  const inputClass = "mt-2 h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10";
  const selectedCouriers: string[] = Array.isArray(tenant.rajaOngkirCourierCodes)
    ? (tenant.rajaOngkirCourierCodes as string[])
    : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title="Toko & Pengiriman" eyebrow="Pengaturan" description="Atur ongkir, pajak, dan berapa lama stok ditahan saat pelanggan belum membayar." />
      <SettingsNav userRole={user.role} />
      <div className="custom-scrollbar flex-1 overflow-auto">
        <form action={saveCommerceSettings} className="mx-auto grid max-w-4xl gap-5 p-4 md:p-6 lg:p-8">
          <section className="rounded-xl border border-stone-200 bg-white p-5">
            <h2 className="text-sm font-black text-stone-900">Cara menerima pesanan</h2>
            <p className="mt-1 text-xs leading-5 text-stone-500">Minimal satu pilihan harus aktif. Ongkir dihitung oleh server, bukan dipercaya dari browser pelanggan.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <label className="flex items-center gap-3 rounded-lg border border-stone-200 p-4 text-sm font-bold"><input name="pickupEnabled" type="checkbox" defaultChecked={tenant.storefrontPickupEnabled} className="size-4" /> Ambil di roastery</label>
              <label className="flex items-center gap-3 rounded-lg border border-stone-200 p-4 text-sm font-bold"><input name="deliveryEnabled" type="checkbox" defaultChecked={tenant.storefrontDeliveryEnabled} className="size-4" /> Pengiriman lokal</label>
              <label className="flex items-center gap-3 rounded-lg border border-stone-200 p-4 text-sm font-bold"><input name="nationalCourierEnabled" type="checkbox" defaultChecked={tenant.nationalCourierEnabled} className="size-4" /> Kurir nasional</label>
            </div>
          </section>

          <section className="rounded-xl border border-stone-200 bg-white p-5">
            <h2 className="text-sm font-black text-stone-900">Asal pengiriman & kurir nasional</h2>
            <p className="mt-1 text-xs leading-5 text-stone-500">
              Pilih tepat satu lokasi asal dari RajaOngkir. Wajib diisi bila kurir nasional diaktifkan.
            </p>
            <div className="mt-4 grid gap-4">
              <OriginSearchPicker
                initial={{
                  id: tenant.rajaOngkirOriginId,
                  label: tenant.rajaOngkirOriginLabel,
                  province: tenant.rajaOngkirOriginProvince,
                  city: tenant.rajaOngkirOriginCity,
                  district: tenant.rajaOngkirOriginDistrict,
                  subdistrict: tenant.rajaOngkirOriginSubdistrict,
                  postalCode: tenant.rajaOngkirOriginPostalCode,
                }}
              />
              <label className="text-xs font-bold uppercase tracking-wider text-stone-600">
                Alamat jalan roastery (detail)
                <input className={inputClass} name="rajaOngkirOriginStreet" type="text" defaultValue={tenant.rajaOngkirOriginStreet ?? ""} placeholder="Jl. Contoh No. 123, detail tambahan" />
              </label>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-stone-600">Kurir nasional yang diizinkan</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {SUPPORTED_COURIERS.map((courier) => (
                    <label key={courier.code} className="flex items-center gap-3 rounded-lg border border-stone-200 p-3 text-sm font-medium">
                      <input
                        name="rajaOngkirCourierCodes"
                        type="checkbox"
                        value={courier.code}
                        defaultChecked={selectedCouriers.includes(courier.code)}
                        className="size-4"
                      />
                      {courier.name}
                    </label>
                  ))}
                </div>
              </div>
              <label className="text-xs font-bold uppercase tracking-wider text-stone-600">
                Tare / berat kemasan default (gram)
                <input className={inputClass} name="rajaOngkirTareGrams" type="number" min="0" max="50000" step="1" defaultValue={tenant.rajaOngkirTareGrams} />
                <span className="mt-1 block normal-case font-normal text-stone-400">Ditambahkan ke total berat produk saat menghitung ongkos kirim nanti.</span>
              </label>
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
