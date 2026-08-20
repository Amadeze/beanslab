"use client";

import Link from "next/link";
import { CreditCard, LayoutDashboard, MonitorCog, ScrollText, TriangleAlert, Truck, Users } from "lucide-react";
import { usePathname } from "next/navigation";

const items = [
  { href: "/superadmin/dashboard", label: "Ringkasan platform", icon: LayoutDashboard, tone: "text-[#15B8C6]" },
  { href: "/superadmin/tenants", label: "Jaringan roastery", icon: Users, tone: "text-[#B65331]" },
  { href: "/superadmin/subscriptions", label: "Subscription", icon: CreditCard, tone: "text-[#AE6A9B]" },
  { href: "/superadmin/incidents", label: "Incident center", icon: TriangleAlert, tone: "text-[#D5A73B]" },
  { href: "/superadmin/studio", label: "Studio fleet", icon: MonitorCog, tone: "text-[#15B8C6]" },
  { href: "/superadmin/integrations/pengiriman/rajaongkir", label: "Integrasi Pengiriman", icon: Truck, tone: "text-[#B65331]" },
  { href: "/superadmin/audit-log", label: "Jejak audit", icon: ScrollText, tone: "text-[#D5A73B]" },
];

export function SuperadminNav({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  if (mobile) {
    return (
      <nav className="flex max-w-[216px] items-center overflow-x-auto" aria-label="Navigasi superadmin">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={`flex size-9 shrink-0 items-center justify-center transition-colors ${active ? "bg-white/10 text-white" : "text-white/55 hover:bg-white/8 hover:text-white"}`}
            >
              <Icon size={18} />
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="flex flex-1 flex-col gap-1 p-4" aria-label="Navigasi superadmin">
      <p className="px-3 pb-3 pt-2 text-[9px] font-bold uppercase tracking-[0.24em] text-white/30">Control room</p>
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`group flex items-center gap-3 border-l-2 px-4 py-3 text-sm font-semibold transition-colors ${
              active
                ? "border-[#B65331] bg-white/8 text-white"
                : "border-transparent text-white/55 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon size={17} className={item.tone} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
