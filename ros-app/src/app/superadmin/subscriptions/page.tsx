import Link from "next/link";
import { ArrowUpRight, CalendarClock, ReceiptText, TriangleAlert } from "lucide-react";

import { requireRole } from "@/lib/auth";
import { PLAN_CATALOG } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { getTenantAccessState } from "@/lib/subscription";

export const dynamic = "force-dynamic";

const idr = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" });

export default async function SubscriptionOperationsPage() {
  await requireRole("SUPERADMIN");
  const now = new Date();
  const nextSevenDays = new Date(now.getTime() + 7 * 86_400_000);
  const [tenants, payments, pendingAmount] = await Promise.all([
    prisma.tenant.findMany({
      where: { id: { not: "default" } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        nextBillingDate: true,
        createdAt: true,
      },
    }),
    prisma.subscriptionPayment.findMany({
      orderBy: { createdAt: "desc" },
      take: 60,
      include: { tenant: { select: { id: true, code: true, name: true } } },
    }),
    prisma.subscriptionPayment.aggregate({ where: { status: "PENDING" }, _sum: { amount: true }, _count: true }),
  ]);

  const activeTenants = tenants.filter((tenant) => getTenantAccessState(tenant, now) === "ACTIVE");
  const mrr = activeTenants.reduce((sum, tenant) => sum + (PLAN_CATALOG[tenant.subscriptionTier].monthlyPrice ?? 0), 0);
  const trialsEnding = tenants.filter((tenant) => tenant.subscriptionTier === "TRIAL" && tenant.trialEndsAt && tenant.trialEndsAt > now && tenant.trialEndsAt <= nextSevenDays);
  const blocked = tenants.filter((tenant) => getTenantAccessState(tenant, now) !== "ACTIVE");
  const paidThisMonth = payments
    .filter((payment) => payment.status === "SUCCESS" && payment.createdAt >= new Date(now.getFullYear(), now.getMonth(), 1))
    .reduce((sum, payment) => sum + Number(payment.amount), 0);

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6 p-5 md:p-8">
      <header className="flex flex-col justify-between gap-4 border-b border-border pb-6 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-domain-sales">Commercial operations</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.05em] md:text-4xl">Subscription & pembayaran</h1>
          <p className="mt-2 text-sm text-muted-foreground">Pantau akses tenant dan arus pembayaran platform tanpa masuk ke transaksi milik tenant.</p>
        </div>
        <span className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">{payments.length} pembayaran terakhir</span>
      </header>

      <section className="grid overflow-hidden bg-[#080B0C] text-white md:grid-cols-4">
        <DarkMetric label="MRR terukur" value={idr.format(mrr)} note={`${activeTenants.length} tenant aktif`} />
        <DarkMetric label="Diterima bulan ini" value={idr.format(paidThisMonth)} note="Pembayaran berstatus sukses" />
        <DarkMetric label="Menunggu pembayaran" value={pendingAmount._count.toString()} note={idr.format(Number(pendingAmount._sum.amount ?? 0))} warn={pendingAmount._count > 0} />
        <DarkMetric label="Akses tertahan" value={blocked.length.toString()} note={`${trialsEnding.length} trial segera berakhir`} warn={blocked.length > 0} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
        <section className="border border-border bg-card">
          <div className="flex items-start justify-between border-b border-border p-5 md:p-6">
            <div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-domain-production">Collection queue</p><h2 className="mt-2 text-xl font-black">Perlu tindakan</h2></div>
            <TriangleAlert size={20} className="text-domain-production" />
          </div>
          <div className="divide-y divide-border">
            {[...blocked, ...trialsEnding.filter((tenant) => !blocked.some((blockedTenant) => blockedTenant.id === tenant.id))].slice(0, 12).map((tenant) => {
              const blockedTenant = getTenantAccessState(tenant, now) !== "ACTIVE";
              return (
                <Link key={tenant.id} href={`/superadmin/tenants/${tenant.id}`} className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/60 md:px-6">
                  <span className={`h-9 w-1 ${blockedTenant ? "bg-red-500" : "bg-amber-400"}`} />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{tenant.name}</p><p className="mt-1 text-xs text-muted-foreground">{blockedTenant ? `${tenant.subscriptionTier} · ${tenant.subscriptionStatus}` : `Trial berakhir ${tenant.trialEndsAt ? date.format(tenant.trialEndsAt) : "—"}`}</p></div>
                  <ArrowUpRight size={15} className="text-muted-foreground" />
                </Link>
              );
            })}
            {blocked.length === 0 && trialsEnding.length === 0 && <Empty text="Tidak ada subscription yang membutuhkan tindakan." />}
          </div>
        </section>

        <section className="overflow-hidden border border-border bg-card">
          <div className="flex items-start justify-between border-b border-border p-5 md:p-6">
            <div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-domain-inventory">Payment ledger</p><h2 className="mt-2 text-xl font-black">Pembayaran terbaru</h2></div>
            <ReceiptText size={20} className="text-domain-inventory" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border bg-muted/60 text-xs uppercase tracking-[0.14em] text-muted-foreground"><tr><th className="px-5 py-3">Waktu</th><th className="px-5 py-3">Tenant</th><th className="px-5 py-3">Order</th><th className="px-5 py-3">Paket</th><th className="px-5 py-3 text-right">Nilai</th><th className="px-5 py-3">Status</th></tr></thead>
              <tbody className="divide-y divide-border">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-muted/40">
                    <td className="px-5 py-4 font-mono text-xs text-muted-foreground">{date.format(payment.createdAt)}</td>
                    <td className="px-5 py-4"><Link href={`/superadmin/tenants/${payment.tenant.id}`} className="font-bold hover:text-primary hover:underline">{payment.tenant.name}</Link><p className="font-mono text-xs text-muted-foreground">{payment.tenant.code}</p></td>
                    <td className="px-5 py-4 font-mono text-xs text-muted-foreground">{payment.midtransOrderId}</td>
                    <td className="px-5 py-4 font-bold">{payment.tier}</td>
                    <td className="px-5 py-4 text-right font-bold tabular-nums">{idr.format(Number(payment.amount))}</td>
                    <td className="px-5 py-4"><Status value={payment.status} /></td>
                  </tr>
                ))}
                {payments.length === 0 && <tr><td colSpan={6}><Empty text="Belum ada pembayaran subscription." /></td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function DarkMetric({ label, value, note, warn = false }: { label: string; value: string; note: string; warn?: boolean }) {
  return <div className="border-b border-white/10 p-5 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"><div className="flex items-center gap-2"><span className={`size-1.5 rounded-full ${warn ? "bg-amber-400" : "bg-[#67D8C8]"}`} /><p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/40">{label}</p></div><p className="mt-4 truncate text-2xl font-black tracking-[-0.04em]">{value}</p><p className="mt-1 text-xs text-white/45">{note}</p></div>;
}

function Status({ value }: { value: string }) {
  const style = value === "SUCCESS" ? "bg-domain-inventory/10 text-domain-inventory" : value === "FAILED" ? "bg-red-500/10 text-red-600" : "bg-amber-500/10 text-amber-700";
  return <span className={`inline-flex px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${style}`}>{value}</span>;
}

function Empty({ text }: { text: string }) {
  return <div className="p-10 text-center text-xs text-muted-foreground"><CalendarClock size={22} className="mx-auto mb-3 opacity-50" />{text}</div>;
}
