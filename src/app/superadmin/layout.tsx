import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SESSION_OPTIONS, type SessionUser } from "@/lib/session";
import { LayoutDashboard, Users, LogOut, Coffee, ShieldCheck } from "lucide-react";
import { logoutAction } from "@/app/login/actions";

import { AppToastProvider } from "@/components/AppToastProvider";

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getIronSession<{ user?: SessionUser }>(await cookies(), SESSION_OPTIONS);
  
  if (!session.user || session.user.role !== "SUPERADMIN") {
    redirect("/login");
  }

  return (
    <AppToastProvider>
      <div className="flex min-h-[100dvh] w-full flex-col overflow-hidden bg-background text-foreground lg:h-[100dvh] lg:flex-row">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-[#080B0C] px-4 text-white lg:hidden">
        <Link href="/superadmin/dashboard" className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Coffee className="size-4" strokeWidth={2.5} />
          </span>
          <span>
            <span className="block text-sm font-black leading-none">roastd.id</span>
            <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.22em] text-white/45">Control plane</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link href="/superadmin/dashboard" aria-label="Dashboard" className="flex size-10 items-center justify-center text-white/65 hover:bg-white/8 hover:text-white">
            <LayoutDashboard size={18} />
          </Link>
          <Link href="/superadmin/tenants" aria-label="Roastery" className="flex size-10 items-center justify-center text-white/65 hover:bg-white/8 hover:text-white">
            <Users size={18} />
          </Link>
        </nav>
      </header>

      <aside className="hidden w-72 shrink-0 flex-col border-r border-white/10 bg-[#080B0C] text-white lg:flex">
        <div className="flex h-24 items-center gap-3 border-b border-white/10 px-6">
          <div className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Coffee className="size-5" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-base font-black leading-none tracking-tight">roastd.id</h1>
            <p className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.24em] text-white/40">Platform control</p>
          </div>
        </div>

        <div className="border-b border-white/10 px-6 py-6">
          <div className="flex items-center gap-3 border border-white/10 bg-white/4 p-4">
            <ShieldCheck className="size-5 text-[#15B8C6]" />
            <div>
              <p className="text-xs font-bold">Platform sehat</p>
              <p className="mt-1 text-[10px] text-white/45">Semua sistem terhubung</p>
            </div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-4">
          <p className="px-3 pb-3 pt-2 text-[9px] font-bold uppercase tracking-[0.24em] text-white/30">Command</p>
          <Link href="/superadmin/dashboard" className="group flex items-center gap-3 px-4 py-3 text-sm font-semibold text-white/60 transition-colors hover:bg-white/6 hover:text-white">
            <LayoutDashboard size={18} className="text-[#15B8C6]" />
            <span>System overview</span>
          </Link>
          <Link href="/superadmin/tenants" className="group flex items-center gap-3 px-4 py-3 text-sm font-semibold text-white/60 transition-colors hover:bg-white/6 hover:text-white">
            <Users size={18} className="text-[#B65331]" />
            <span>Roastery network</span>
          </Link>
        </nav>

        <div className="border-t border-white/10 p-4">
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex min-h-11 w-full items-center gap-3 px-4 text-sm font-semibold text-white/50 transition-colors hover:bg-destructive/10 hover:text-red-300"
            >
              <LogOut size={18} />
              <span>Keluar</span>
            </button>
          </form>
        </div>
      </aside>

      <main className="relative min-w-0 flex-1 overflow-auto bg-background">
        {children}
      </main>
      </div>
    </AppToastProvider>
  );
}
