import {
  Bell,
  Building2,
  Cable,
  CircleDollarSign,
  Cpu,
  CreditCard,
  LayoutGrid,
  Monitor,
  Paintbrush,
  ScrollText,
  Truck,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";

import { canAccessTenantRole } from "@/lib/roles";

export type SettingsGroup = "Toko & identitas" | "Operasional & integrasi" | "Akses & tata kelola";

export type SettingsNavigationItem = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  roles: readonly string[];
  group: SettingsGroup | null;
};

export const SETTINGS_NAVIGATION: readonly SettingsNavigationItem[] = [
  {
    label: "Ringkasan",
    description: "Pilih bagian pengaturan yang ingin dikelola.",
    href: "/settings",
    icon: LayoutGrid,
    roles: ["OWNER", "MANAGER"],
    group: null,
  },
  {
    label: "Profil Roastery",
    description: "Identitas usaha, logo, kontak, alamat, dan informasi portal.",
    href: "/settings/organization",
    icon: Building2,
    roles: ["OWNER"],
    group: "Toko & identitas",
  },
  {
    label: "Tampilan Storefront",
    description: "Tema, susunan halaman, warna, tipografi, dan pratinjau toko.",
    href: "/settings/portal-customizer",
    icon: Paintbrush,
    roles: ["OWNER"],
    group: "Toko & identitas",
  },
  {
    label: "Pembayaran Portal",
    description: "Rekening dan QRIS untuk instruksi pembayaran pelanggan.",
    href: "/settings/payments",
    icon: CircleDollarSign,
    roles: ["OWNER"],
    group: "Toko & identitas",
  },
  {
    label: "Toko & Pengiriman",
    description: "Metode kirim, asal pengiriman, kurir, pajak, dan penahanan stok.",
    href: "/settings/commerce",
    icon: Truck,
    roles: ["OWNER"],
    group: "Toko & identitas",
  },
  {
    label: "Mesin Roasting",
    description: "Daftar mesin, kapasitas batch, dan status operasional.",
    href: "/settings/machines",
    icon: Cpu,
    roles: ["OWNER", "MANAGER"],
    group: "Operasional & integrasi",
  },
  {
    label: "Integrasi Artisan",
    description: "Hubungkan Artisan dan pantau impor profil serta sesi roasting.",
    href: "/settings/integrations/artisan",
    icon: Cable,
    roles: ["OWNER", "MANAGER"],
    group: "Operasional & integrasi",
  },
  {
    label: "Roastd Studio",
    description: "Unduh aplikasi dan pantau perangkat Studio yang sudah masuk.",
    href: "/settings/studio",
    icon: Monitor,
    roles: ["OWNER"],
    group: "Operasional & integrasi",
  },
  {
    label: "Notifikasi",
    description: "Atur pengingat invoice jatuh tempo untuk pelanggan.",
    href: "/settings/notifications",
    icon: Bell,
    roles: ["OWNER", "MANAGER"],
    group: "Operasional & integrasi",
  },
  {
    label: "Anggota Tim",
    description: "Kelola anggota, peran kerja, dan status akses workspace.",
    href: "/settings/team",
    icon: Users,
    roles: ["OWNER"],
    group: "Akses & tata kelola",
  },
  {
    label: "Aktivitas & Audit",
    description: "Telusuri perubahan penting, event integrasi, dan reminder.",
    href: "/audit",
    icon: ScrollText,
    roles: ["OWNER", "MANAGER"],
    group: "Akses & tata kelola",
  },
  {
    label: "Impor Data Lama",
    description: "Impor persediaan awal dengan aman tanpa menggandakan data.",
    href: "/settings/import",
    icon: Upload,
    roles: ["OWNER", "MANAGER"],
    group: "Akses & tata kelola",
  },
  {
    label: "Paket & Tagihan",
    description: "Paket roastd.id, status langganan, dan pembayaran.",
    href: "/billing",
    icon: CreditCard,
    roles: ["OWNER"],
    group: "Akses & tata kelola",
  },
] as const;

export const SETTINGS_GROUPS: readonly SettingsGroup[] = [
  "Toko & identitas",
  "Operasional & integrasi",
  "Akses & tata kelola",
];

export function getVisibleSettingsNavigation(userRole: string) {
  return SETTINGS_NAVIGATION.filter((item) =>
    canAccessTenantRole(userRole, item.roles),
  );
}
