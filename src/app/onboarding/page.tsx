import { requireRole, requireTenantPrisma } from "@/lib/auth";
import { OnboardingClient } from "./OnboardingClient";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  await requireRole("OWNER");
  const tp = await requireTenantPrisma();
  const [activePaymentMethods, machines, products] = await Promise.all([
    tp.tenantPaymentMethod.count({ where: { isActive: true, provider: "MANUAL" } }),
    tp.machine.count({ where: { isActive: true } }),
    tp.product.count({ where: { isActive: true } }),
  ]);

  return <OnboardingClient readiness={{ activePaymentMethods, machines, products }} />;
}
