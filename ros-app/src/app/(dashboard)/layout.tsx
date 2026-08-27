import { AppShellV2 } from "@/components/layout/AppShellV2";
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

  const lowStockCount =
    accessState === "ACTIVE"
      ? await prisma.product.count({
          where: { tenantId: user.tenantId, stockKg: { lt: prisma.product.fields.safetyStockQuantity }, isActive: true },
        })
      : 0;
      
  const unfulfilledOrders =
    accessState === "ACTIVE"
      ? await prisma.invoice.count({
          where: { 
            tenantId: user.tenantId, 
            fulfillmentStatus: { in: ["PAID", "NEEDS_PRODUCTION", "READY_TO_PACK", "PACKED"] },
            status: { not: "VOID" }
          },
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
      <AppShellV2
        userRole={user.role}
        subscriptionTier={tenant?.subscriptionTier || "TRIAL"}
        pendingPaymentReviews={pendingPaymentReviews}
        lowStockCount={lowStockCount}
        unfulfilledOrders={unfulfilledOrders}
      >
        {children}
        <OfflineIndicator />
      </AppShellV2>
    </AppToastProvider>
  );
}
