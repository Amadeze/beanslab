"use server";

import { requireRole, requireTenantPrisma } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function savePortalTheme(data: {
  themeId: string;
  heroTitle?: string;
  heroSubtitle?: string;
  heroButtonText?: string;
  heroImageUrl?: string;
  aboutTitle?: string;
  aboutText?: string;
  contactTitle?: string;
  contactText?: string;
  brandName?: string;
}) {
  try {
    const user = await requireRole("OWNER");
    const tenantPrisma = await requireTenantPrisma();

    const existing = await tenantPrisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { themeConfig: true },
    });

    const currentConfig = existing?.themeConfig && typeof existing.themeConfig === "object"
      ? existing.themeConfig as Record<string, any>
      : {};

    const updatedConfig = {
      ...currentConfig,
      portalTheme: data.themeId,
      portalCustomizations: {
        heroTitle: data.heroTitle,
        heroSubtitle: data.heroSubtitle,
        heroButtonText: data.heroButtonText,
        heroImageUrl: data.heroImageUrl,
        aboutTitle: data.aboutTitle,
        aboutText: data.aboutText,
        contactTitle: data.contactTitle,
        contactText: data.contactText,
        brandName: data.brandName,
      },
    };

    await tenantPrisma.tenant.update({
      where: { id: user.tenantId },
      data: { themeConfig: updatedConfig as any },
    });

    revalidatePath("/settings/portal-customizer");
    revalidatePath(`/tenant/${user.tenantId}`);

    return { success: true };
  } catch (err) {
    console.error("[savePortalTheme]", err);
    return { success: false, error: "Failed to save" };
  }
}

export async function loadPortalTheme() {
  try {
    const user = await requireRole("OWNER");
    const tenantPrisma = await requireTenantPrisma();

    const tenant = await tenantPrisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { themeConfig: true, subdomain: true },
    });

    const config = tenant?.themeConfig && typeof tenant.themeConfig === "object"
      ? tenant.themeConfig as Record<string, any>
      : {};

    return {
      success: true,
      data: {
        themeId: config.portalTheme || "heritage",
        customizations: config.portalCustomizations || {},
        subdomain: tenant?.subdomain || "",
      },
    };
  } catch (err) {
    console.error("[loadPortalTheme]", err);
    return { success: false, error: "Failed to load" };
  }
}
