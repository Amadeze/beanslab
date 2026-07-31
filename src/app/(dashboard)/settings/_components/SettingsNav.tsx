"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Building2, CircleDollarSign, Cpu, CreditCard, LayoutGrid, Monitor, ScrollText, Truck, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { canAccessTenantRole } from "@/lib/roles";

const items = [
  { label: "Ringkasan", href: "/settings", icon: LayoutGrid, roles: ["OWNER", "MANAGER"] },
  { label: "Profil & Portal", href: "/settings/organization", icon: Building2, roles: ["OWNER"] },
  { label: "Pembayaran Portal", href: "/settings/payments", icon: CircleDollarSign, roles: ["OWNER"] },
  { label: "Toko & Pengiriman", href: "/settings/commerce", icon: Truck, roles: ["OWNER"] },
  { label: "Anggota Tim", href: "/settings/team", icon: Users, roles: ["OWNER"] },
  { label: "Mesin", href: "/settings/machines", icon: Cpu, roles: ["OWNER", "MANAGER"] },
  { label: "Roastd Studio", href: "/settings/studio", icon: Monitor, roles: ["OWNER"] },
  { label: "Notifikasi", href: "/settings/notifications", icon: Bell, roles: ["OWNER", "MANAGER"] },
  { label: "Aktivitas & Audit", href: "/audit", icon: ScrollText, roles: ["OWNER", "MANAGER"] },
  { label: "Paket & Tagihan", href: "/billing", icon: CreditCard, roles: ["OWNER"] },
] as const;

export function SettingsNav({ userRole }: { userRole: string }) {
  const pathname = usePathname();
  const visibleItems = items.filter((item) =>
    canAccessTenantRole(userRole, item.roles),
  );

  return (
    <nav className="overflow-x-auto border-b border-stone-200 bg-white" aria-label="Navigasi pengaturan">
      <div className="mx-auto flex w-max min-w-full max-w-[1600px] gap-1 px-4 py-2 md:px-6 lg:px-8">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/settings"
            ? pathname === "/settings"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900",
                active ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
              )}
            >
              <Icon size={14} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
