import { AppShell } from "@/components/layout/AppShell";
import { getTenantAccessRecord, requireCurrentUser, requireTenantPrisma } from "@/lib/auth";
import { AppToastProvider } from "@/components/AppToastProvider";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireCurrentUser();
  const tenant = await getTenantAccessRecord(user.tenantId);
  const tenantPrisma = await requireTenantPrisma();
  const pendingPaymentReviews = await tenantPrisma.paymentSubmission.count({
    where: { status: "AWAITING_VERIFICATION" },
  });

  if (!tenant?.setupCompletedAt) {
    const headerList = await headers();
    const pathname = headerList.get("x-pathname") || "/dashboard";
    if (
      !pathname.startsWith("/onboarding") &&
      !pathname.startsWith("/settings")
    ) {
      redirect("/onboarding");
    }
  }

  return (
    <AppToastProvider>
      <AppShell
        userRole={user.role}
        subscriptionTier={tenant?.subscriptionTier || "TRIAL"}
        pendingPaymentReviews={pendingPaymentReviews}
      >
        {children}
        <OfflineIndicator />
      </AppShell>
    </AppToastProvider>
  );
}
