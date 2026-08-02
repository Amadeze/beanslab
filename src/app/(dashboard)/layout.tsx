import { AppShell } from "@/components/layout/AppShell";
import { getTenantAccessRecord, requireCurrentUser } from "@/lib/auth";
import { getTenantAccessState } from "@/lib/subscription";
import { prisma } from "@/lib/prisma";
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
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") || "/dashboard";

  if (!tenant || !tenant.isActive) {
    redirect("/login");
  }

  const accessState = getTenantAccessState(tenant);
  if (
    accessState === "SUBSCRIPTION_REQUIRED" &&
    !pathname.startsWith("/billing")
  ) {
    redirect("/billing");
  }

  const pendingPaymentReviews =
    accessState === "ACTIVE"
      ? await prisma.paymentSubmission.count({
          where: { status: "AWAITING_VERIFICATION", tenantId: user.tenantId },
        })
      : 0;

  if (
    !tenant?.setupCompletedAt &&
    !pathname.startsWith("/onboarding") &&
    !pathname.startsWith("/settings")
  ) {
    redirect("/onboarding");
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
