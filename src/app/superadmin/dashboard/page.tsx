import { prisma } from "@/lib/prisma";
import { PLAN_CATALOG } from "@/lib/plans";
import { getTenantAccessState } from "@/lib/subscription";
import { SuperadminShell } from "./_components/SuperadminShell";
import { getCurrentDate } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

export default async function SuperadminDashboard() {
  const now = getCurrentDate();
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const nextSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const [tenants, gmvTotal, connectorTotal, connectorOnline, pendingPayments, failedImports24h, failedJobs24h] = await Promise.all([
    prisma.tenant.findMany({ 
      where: { id: { not: "default" } },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.invoice.aggregate({
      where: { status: { in: ["PAID", "ISSUED", "PARTIAL"] } },
      _sum: { grandTotal: true }
    }),
    prisma.roastdStudio.count({ where: { revokedAt: null } }),
    prisma.roastdStudio.count({ where: { status: "ONLINE", revokedAt: null } }),
    prisma.subscriptionPayment.count({ where: { status: "PENDING" } }),
    prisma.artisanRoastImport.count({ where: { status: "FAILED", uploadedAt: { gte: last24Hours } } }),
    prisma.jobRun.count({ where: { status: "FAILED", startedAt: { gte: last24Hours } } }),
  ]);

  const totalGmv = gmvTotal._sum.grandTotal ? Number(gmvTotal._sum.grandTotal) : 0;
  
  // Calculate MRR
  let mrr = 0;
  let activeCount = 0;
  
  tenants.forEach(t => {
    if (getTenantAccessState(t) === "ACTIVE") {
      activeCount++;
      mrr += PLAN_CATALOG[t.subscriptionTier].monthlyPrice ?? 0;
    }
  });

  // Calculate new tenants this month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const newTenantsThisMonth = tenants.filter(t => new Date(t.createdAt) >= startOfMonth).length;

  // Tenant growth over the last six calendar months.
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const growthData = Array.from({length: 6}).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const m = months[d.getMonth()];
    // Calculate how many tenants existed at the end of that month
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() - 4 + i, 0);
    const count = tenants.filter(t => new Date(t.createdAt) <= endOfMonth).length;
    return { name: m, tenants: count };
  });

  const recentTenants = tenants.slice(0, 5).map(t => ({
    id: t.id,
    name: t.name,
    subdomain: t.subdomain,
    tier: t.subscriptionTier,
    status: t.subscriptionStatus,
    createdAt: t.createdAt.toISOString(),
    accessState: getTenantAccessState(t),
  }));

  const attentionTenants: Array<{
    id: string;
    name: string;
    code: string;
    reason: string;
    severity: "warning" | "critical";
  }> = [];
  for (const tenant of tenants) {
      const accessState = getTenantAccessState(tenant, now);
      if (!tenant.isActive) {
        attentionTenants.push({ id: tenant.id, name: tenant.name, code: tenant.code, reason: "Tenant dinonaktifkan", severity: "critical" });
        continue;
      }
      if (accessState !== "ACTIVE") {
        attentionTenants.push({ id: tenant.id, name: tenant.name, code: tenant.code, reason: "Akses subscription tertahan", severity: "critical" });
        continue;
      }
      if (
        tenant.subscriptionTier === "TRIAL" &&
        tenant.trialEndsAt &&
        tenant.trialEndsAt > now &&
        tenant.trialEndsAt <= nextSevenDays
      ) {
        const days = Math.max(1, Math.ceil((tenant.trialEndsAt.getTime() - now.getTime()) / 86_400_000));
        attentionTenants.push({ id: tenant.id, name: tenant.name, code: tenant.code, reason: `Trial berakhir ${days} hari lagi`, severity: "warning" });
      }
  }
  attentionTenants.splice(6);

  const planDistribution = (["TRIAL", "BASIC", "PRO", "ENTERPRISE"] as const).map((tier) => ({
    tier,
    count: tenants.filter((tenant) => tenant.subscriptionTier === tier).length,
  }));

  const data = {
    totalTenants: tenants.length,
    activeTenants: activeCount,
    newTenantsThisMonth,
    mrr,
    totalGmv,
    growthData,
    recentTenants,
    attentionTenants,
    planDistribution,
    connectorTotal,
    connectorOnline,
    connectorOffline: Math.max(0, connectorTotal - connectorOnline),
    pendingPayments,
    failedImports24h,
    failedJobs24h,
    generatedAt: now.toISOString(),
  };

  return <SuperadminShell data={data} />;
}
