import { PageHeader } from "@/components/layout/PageHeader";
import { requireRole, requireTenantPrisma } from "@/lib/auth";
import { SettingsNav } from "../_components/SettingsNav";
import { PaymentMethodsClient } from "./PaymentMethodsClient";

export const dynamic = "force-dynamic";

export default async function PaymentSettingsPage() {
  const user = await requireRole("OWNER");
  const tp = await requireTenantPrisma();
  const methods = await tp.tenantPaymentMethod.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      method: true,
      label: true,
      bankName: true,
      accountNumber: true,
      accountHolder: true,
      qrisImageUrl: true,
      instructions: true,
      requireProof: true,
      isActive: true,
    },
  });
  const tenant = await tp.tenant.findUnique({
    where: { id: user.tenantId },
    select: { xenditEnabled: true, xenditSubAccountId: true },
  });
  const activeMethods = methods.filter((method) => method.isActive).length;
  const xenditConfigured = Boolean(process.env.XENDIT_SECRET_KEY && tenant?.xenditSubAccountId);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Pembayaran Portal"
        eyebrow="Pengaturan"
        description="Gunakan rekening atau QRIS milik roastery. Bukti bayar selalu menunggu verifikasi sebelum invoice dilunasi."
      />
      <SettingsNav userRole={user.role} />
      <div className="custom-scrollbar flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl p-4 md:p-6 lg:p-8">
          <div className="mb-5 grid gap-3 md:grid-cols-2">
            <section className={`rounded-xl border p-4 ${activeMethods > 0 ? "border-emerald-200 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}><p className="text-xs font-bold uppercase tracking-wider text-stone-500">Jalur aktif sekarang</p><h2 className="mt-1 text-sm font-black text-stone-900">{activeMethods > 0 ? `${activeMethods} rekening / QRIS siap` : "Belum siap menerima pembayaran portal"}</h2><p className="mt-1 text-xs leading-5 text-stone-600">Metode manual tenant tetap menjadi jalur utama dan tidak membutuhkan onboarding payment gateway.</p></section>
            <section className="rounded-xl border border-stone-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wider text-stone-500">Pembayaran otomatis · tahap berikutnya</p><h2 className="mt-1 text-sm font-black text-stone-900">{xenditConfigured && tenant?.xenditEnabled ? "Konfigurasi tersedia, belum aktif" : "Belum tersedia"}</h2><p className="mt-1 text-xs leading-5 text-stone-600">Fitur ini belum dibuka untuk transaksi pelanggan. Pembayaran manual tetap berjalan seperti biasa.</p></section>
          </div>
          <PaymentMethodsClient initialMethods={methods} />
        </div>
      </div>
    </div>
  );
}
