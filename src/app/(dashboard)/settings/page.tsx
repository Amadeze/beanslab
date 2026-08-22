import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { SettingsNav } from "./_components/SettingsNav";
import {
  SETTINGS_GROUPS,
  getVisibleSettingsNavigation,
} from "./_components/settings-navigation";

export default async function SettingsPage() {
  const user = await requireRole("OWNER", "MANAGER");
  const visibleItems = getVisibleSettingsNavigation(user.role).filter(
    (item) => item.group !== null,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Pengaturan"
        eyebrow="Sistem"
        description="Organisasi, anggota tim, perangkat, integrasi, keamanan, dan langganan."
      />
      <SettingsNav userRole={user.role} />
      <div className="custom-scrollbar flex-1 overflow-auto">
        <div className="mx-auto max-w-[1200px] space-y-8 p-4 md:p-6 lg:p-8">
          {SETTINGS_GROUPS.map((group, groupIndex) => {
            const groupItems = visibleItems.filter((item) => item.group === group);
            if (groupItems.length === 0) return null;
            const headingId = `settings-group-${groupIndex + 1}`;

            return (
              <section key={group} aria-labelledby={headingId}>
                <div className="mb-3 flex items-center gap-3">
                  <h2
                    id={headingId}
                    className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500"
                  >
                    {group}
                  </h2>
                  <span className="h-px flex-1 bg-stone-200" aria-hidden />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {groupItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="group grid min-h-[132px] grid-cols-[40px_minmax(0,1fr)_24px] items-start gap-4 rounded-xl border border-stone-200 bg-white p-5 transition-colors hover:border-stone-300 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-stone-100 text-stone-700">
                          <Icon size={18} aria-hidden />
                        </span>
                        <span>
                          <span className="block text-sm font-bold text-stone-900">{item.label}</span>
                          <span className="mt-1.5 block text-xs leading-5 text-stone-500">{item.description}</span>
                        </span>
                        <ChevronRight size={16} aria-hidden className="mt-1 text-stone-300 transition-transform group-hover:translate-x-0.5 group-hover:text-stone-600" />
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
