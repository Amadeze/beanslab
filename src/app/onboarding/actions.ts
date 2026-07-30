"use server";

import { requireRole, requireTenantPrisma } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function resetOnboarding(): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireRole("OWNER");
    const tenantPrisma = await requireTenantPrisma();
    await tenantPrisma.tenant.update({
      where: { id: user.tenantId },
      data: { setupCompletedAt: null },
    });

    revalidatePath("/settings");
    revalidatePath("/onboarding");
    return { success: true };
  } catch (err) {
    console.error("[resetOnboarding]", err);
    return { success: false, error: "Gagal reset panduan awal." };
  }
}

export async function completeOnboarding(): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireRole("OWNER");
    const tenantPrisma = await requireTenantPrisma();
    const activePaymentMethods = await tenantPrisma.tenantPaymentMethod.count({
      where: { isActive: true, provider: "MANUAL" },
    });
    if (activePaymentMethods === 0) {
      return { success: false, error: "Tambahkan minimal satu rekening atau QRIS aktif terlebih dahulu." };
    }

    await tenantPrisma.tenant.update({
      where: { id: user.tenantId },
      data: { setupCompletedAt: new Date() },
    });

    revalidatePath("/dashboard");
    revalidatePath("/onboarding");
    return { success: true };
  } catch (err) {
    console.error("[completeOnboarding]", err);
    return { success: false, error: "Gagal menyelesaikan panduan." };
  }
}
