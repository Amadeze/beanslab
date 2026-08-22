import Link from "next/link";
import {
  ArrowUpRight,
  BellRing,
  CheckCircle2,
  Cloud,
  CreditCard,
  Database,
  KeyRound,
  MessageCircle,
  ShieldCheck,
  Truck,
  TriangleAlert,
} from "lucide-react";

import { requireRole } from "@/lib/auth";
import { getRajaOngkirIntegrationState } from "@/lib/shipping/platform-integration";

export const dynamic = "force-dynamic";

type IntegrationState = {
  name: string;
  purpose: string;
  status: "ready" | "attention" | "missing";
  icon: React.ReactNode;
  href?: string;
  note: string;
};

export default async function PlatformIntegrationsPage() {
  await requireRole("SUPERADMIN");
  const rajaOngkir = await getRajaOngkirIntegrationState();

  const integrations: IntegrationState[] = [
    {
      name: "Email transaksional",
      purpose: "Reset akses, invoice, dan pemberitahuan sistem.",
      status: process.env.RESEND_API_KEY ? "ready" : "missing",
      icon: <BellRing size={18} />,
      note: "Isi RESEND_API_KEY dan EMAIL_FROM di Environment Vercel.",
    },
    {
      name: "WhatsApp",
      purpose: "Pengingat pembayaran dan bantuan komunikasi tenant.",
      status: process.env.WA_API_KEY ? "ready" : "missing",
      icon: <MessageCircle size={18} />,
      note: "Isi WA_API_KEY; WA_API_URL opsional bila bukan endpoint default.",
    },
    {
      name: "Billing SaaS",
      purpose: "Pembayaran paket roastd.id kepada platform.",
      status: process.env.MIDTRANS_SERVER_KEY && process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ? "ready" : "missing",
      icon: <CreditCard size={18} />,
      note: "Butuh MIDTRANS_SERVER_KEY dan NEXT_PUBLIC_MIDTRANS_CLIENT_KEY; berbeda dari credential storefront tenant.",
    },
    {
      name: "Penyimpanan berkas",
      purpose: "Bukti pembayaran, logo, gambar portal, dan dokumen privat.",
      status: (
        process.env.SUPABASE_URL &&
        process.env.SUPABASE_SERVICE_ROLE_KEY &&
        process.env.SUPABASE_STORAGE_BUCKET &&
        process.env.SUPABASE_PRIVATE_STORAGE_BUCKET
      ) ? "ready" : "missing",
      icon: <Cloud size={18} />,
      note: "Bucket publik dan privat dikelola sebagai infrastruktur platform.",
    },
    {
      name: "Database operasional",
      purpose: "Data seluruh tenant dengan isolasi dan audit per tenant.",
      status: process.env.DATABASE_URL && process.env.DIRECT_URL ? "ready" : "missing",
      icon: <Database size={18} />,
      note: "Koneksi database tidak pernah ditampilkan atau diubah dari aplikasi.",
    },
    {
      name: "Brankas credential",
      purpose: "Enkripsi server key tenant dan credential integrasi yang disimpan aplikasi.",
      status: process.env.CREDENTIAL_ENCRYPTION_KEY ? "ready" : "missing",
      icon: <KeyRound size={18} />,
      note: "CREDENTIAL_ENCRYPTION_KEY wajib tersimpan di Environment Vercel dan tidak boleh dipindahkan ke UI.",
    },
    {
      name: "RajaOngkir",
      purpose: "Tarif dan tujuan pengiriman nasional untuk tenant.",
      status: !rajaOngkir.isConfigured
        ? "missing"
        : rajaOngkir.isActive && rajaOngkir.connectionStatus === "OK"
          ? "ready"
          : "attention",
      icon: <Truck size={18} />,
      href: "/superadmin/integrations/pengiriman/rajaongkir",
      note: rajaOngkir.connectionStatus === "FAILED"
        ? "Tes koneksi terakhir gagal; buka detail untuk memeriksa status aman."
        : rajaOngkir.lastTestedAt
          ? `Tes terakhir ${rajaOngkir.lastTestedAt.toLocaleString("id-ID")}.`
        : "API key dienkripsi dan dapat diuji dari superadmin.",
    },
  ];

  const readyCount = integrations.filter((item) => item.status === "ready").length;

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6 p-5 md:p-8">
      <header className="grid gap-5 border-b border-border pb-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-domain-roasting">Platform services</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.05em] md:text-4xl">Integrasi platform</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Lihat layanan yang menopang seluruh tenant. Secret infrastruktur tetap berada di Vercel; aplikasi hanya menampilkan status aman tanpa nilai credential.
          </p>
        </div>
        <div className={`flex min-h-11 items-center gap-2 px-4 text-sm font-bold ${readyCount === integrations.length ? "bg-domain-inventory/10 text-domain-inventory" : "bg-amber-500/10 text-amber-800"}`}>
          {readyCount === integrations.length ? <CheckCircle2 size={17} /> : <TriangleAlert size={17} />}
          {readyCount}/{integrations.length} layanan siap
        </div>
      </header>

      <section aria-labelledby="platform-services-title" className="overflow-hidden border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-5 md:p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Dikelola roastd.id</p>
            <h2 id="platform-services-title" className="mt-2 text-xl font-black">Kesehatan layanan global</h2>
          </div>
          <ShieldCheck size={20} className="text-domain-inventory" aria-hidden />
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-3">
          {integrations.map((item) => (
            <article key={item.name} className="border-b border-border p-5 md:border-r md:p-6">
              <div className="flex items-start justify-between gap-4">
                <span className="flex size-10 items-center justify-center bg-muted text-foreground">{item.icon}</span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold ${item.status === "ready" ? "bg-domain-inventory/10 text-domain-inventory" : "bg-amber-500/10 text-amber-800"}`}>
                  <span className={`size-1.5 rounded-full ${item.status === "ready" ? "bg-domain-inventory" : "bg-amber-600"}`} aria-hidden />
                  {item.status === "ready" ? "Siap" : item.status === "attention" ? "Perlu diuji" : "Belum dikonfigurasi"}
                </span>
              </div>
              <h3 className="mt-5 text-base font-black">{item.name}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.purpose}</p>
              <p className="mt-4 border-l-2 border-border pl-3 text-xs leading-5 text-muted-foreground">{item.note}</p>
              {item.href ? (
                <Link href={item.href} className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-domain-roasting hover:underline">
                  Kelola integrasi <ArrowUpRight size={15} aria-hidden />
                </Link>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 border border-border bg-[#080B0C] p-5 text-white md:grid-cols-[auto_1fr] md:items-center md:p-6">
        <span className="flex size-11 items-center justify-center bg-white/10 text-[#67D8C8]"><ShieldCheck size={20} aria-hidden /></span>
        <div>
          <h2 className="font-black">Credential tenant tetap dimiliki tenant</h2>
          <p className="mt-1 text-sm leading-6 text-white/55">Midtrans storefront, asal pengiriman, kurir, dan koneksi Studio dilihat per roastery melalui menu Tenant & dukungan. Superadmin dapat membantu mengganti credential tanpa pernah membaca kembali secret lama.</p>
        </div>
      </section>
    </div>
  );
}
