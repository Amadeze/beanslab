import Link from "next/link";
import { Bell, Building2, ChevronRight, CircleDollarSign, Cpu, CreditCard, Monitor, Paintbrush, ScrollText, Users } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { SettingsNav } from "./_components/SettingsNav";

const settingsGroups = [
  {
    title: "Notifikasi",
    description: "Atur channel pengingat invoice jatuh tempo untuk pelanggan.",
    href: "/settings/notifications",
    icon: Bell,
    roles: ["OWNER", "MANAGER"],
  },
  {
    title: "Profil & Portal",
    description: "Identitas roastery, tampilan storefront, kontak, dan pembayaran portal.",
    href: "/settings/organization",
    icon: Building2,
    roles: ["OWNER"],
  },
  {
    title: "Anggota Tim",
    description: "Kelola anggota, peran kerja, dan status akses workspace.",
    href: "/settings/team",
    icon: Users,
    roles: ["OWNER"],
  },
  {
    title: "Pembayaran Portal",
    description: "Rekening dan QRIS tenant, unggah bukti, dan verifikasi pembayaran pelanggan.",
    href: "/settings/payments",
    icon: CircleDollarSign,
    roles: ["OWNER"],
  },
  {
    title: "Mesin Roasting",
    description: "Daftarkan mesin, kapasitas batch, dan status mesin aktif.",
    href: "/settings/machines",
    icon: Cpu,
    roles: ["OWNER", "MANAGER"],
  },
  {
    title: "Roastd Studio",
    description: "Unduh aplikasi dan pantau perangkat Studio yang sudah login.",
    href: "/settings/studio",
    icon: Monitor,
    roles: ["OWNER"],
  },
  {
    title: "Aktivitas & Audit",
    description: "Telusuri perubahan penting, event integrasi, dan pengiriman reminder.",
    href: "/audit",
    icon: ScrollText,
    roles: ["OWNER", "MANAGER"],
  },
  {
    title: "Paket & Tagihan",
    description: "Paket roastd.id, status langganan, dan pembayaran.",
    href: "/billing",
    icon: CreditCard,
    roles: ["OWNER"],
  },
  {
    title: "Portal Theme Customizer",
    description: "Block-based visual customizer for your B2B portal storefront.",
    href: "/settings/portal-customizer",
    icon: Paintbrush,
    roles: ["OWNER"],
  },
] as const;

export default async function SettingsPage() {
  const user = await requireRole("OWNER", "MANAGER");
  const visibleGroups = settingsGroups.filter((group) => (group.roles as readonly string[]).includes(user.role));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Pengaturan"
        eyebrow="Sistem"
        description="Organisasi, anggota tim, perangkat, integrasi, keamanan, dan langganan."
      />
      <SettingsNav userRole={user.role} />
      <div className="custom-scrollbar flex-1 overflow-auto">
        <div className="mx-auto grid max-w-[1200px] gap-3 p-4 md:grid-cols-2 md:p-6 lg:p-8">
          {visibleGroups.map((group) => {
            const Icon = group.icon;
            return (
              <Link
                key={group.href}
                href={group.href}
                className="group grid min-h-[132px] grid-cols-[40px_minmax(0,1fr)_24px] items-start gap-4 rounded-xl border border-stone-200 bg-white p-5 transition-colors hover:border-stone-300 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-stone-100 text-stone-700">
                  <Icon size={18} />
                </span>
                <span>
                  <span className="block text-sm font-bold text-stone-900">{group.title}</span>
                  <span className="mt-1.5 block text-xs leading-5 text-stone-500">{group.description}</span>
                </span>
                <ChevronRight size={16} className="mt-1 text-stone-300 transition-transform group-hover:translate-x-0.5 group-hover:text-stone-600" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
