"use server";

import { recordAudit } from "@/lib/audit";
import { encryptCredential } from "@/lib/credentials";
import { revalidatePath } from "next/cache";

import { requireRole, requireTenantPrisma } from "@/lib/auth";

import { z } from "zod";
import { Prisma } from "@prisma/client";

const optionalText = (max: number) => z.string().trim().max(max).optional();
const optionalUrl = z.union([
  z.literal(""),
  z.string().url().max(2_048),
  z.string().max(2_048).refine(
    (value) => value.startsWith("/") && !value.startsWith("//"),
    "Relative asset URL must start with a single slash.",
  ),
]).optional();
const FeatureSchema = z.object({
  title: z.string().trim().min(1).max(80),
  desc: z.string().trim().min(1).max(500),
  iconName: z.string().trim().max(40).optional(),
});
const TestimonialSchema = z.object({
  name: z.string().trim().min(1).max(80),
  role: z.string().trim().max(100).optional(),
  text: z.string().trim().min(1).max(1_000),
  rating: z.number().int().min(1).max(5).default(5),
});
const FaqSchema = z.object({
  question: z.string().trim().min(1).max(200),
  answer: z.string().trim().min(1).max(1_500),
});

const SettingsSchema = z.object({
  name: optionalText(120),
  timezone: z.enum(["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"]).optional(),
  themeColor: z.enum(["amber", "blue", "emerald", "rose", "violet", "zinc"]).optional(),
  heroText: optionalText(300),
  logoUrl: optionalUrl,
  heroImageUrl: optionalUrl,
  layoutStyle: z.enum([
    "heritage", "neomodern", "cyber", "botanical", "editorial",
    "liquid", "industrial", "club", "luxury", "playful",
  ]).optional(),
  whatsappNumber: optionalText(30),
  aboutText: optionalText(2_000),
  catalogTitle: optionalText(120),
  catalogSubtitle: optionalText(500),
  footerText: optionalText(300),
  midtransClientKey: optionalText(255),
  midtransServerKey: optionalText(255),
  midtransIsProduction: z.boolean().optional(),
  isArtisanEnabled: z.boolean().optional(),
  backgroundImageUrl: optionalUrl,
  contactEmail: z.union([z.literal(""), z.string().email().max(254)]).optional(),
  instagramHandle: optionalText(100),
  fontFamily: z.enum(["sans", "serif", "mono"]).optional(),
  themeMode: z.enum(["light", "dark"]).optional(),
  borderRadius: z.enum(["none", "sm", "md", "xl", "full"]).optional(),
  animationStyle: z.enum([
    "none", "subtle", "bouncy", "float", "fast", "cinematic", "spring", "staggered",
  ]).optional(),
  animationDirection: z.enum(["up", "down", "left", "right"]).optional(),
  iconStyle: z.enum(["thin", "light", "regular", "bold", "fill", "duotone"]).optional(),
  themeConfig: z.record(z.string(), z.unknown()).optional(),
  problemStatement: optionalText(1_500),
  solutionStatement: optionalText(1_500),
  uspText: optionalText(1_500),
  features: z.array(FeatureSchema).max(12).optional(),
  testimonials: z.array(TestimonialSchema).max(12).optional(),
  faqs: z.array(FaqSchema).max(20).optional(),
}).strict();

export type SettingsActionResult =
  | { success: true }
  | { success: false; error: string };

export async function updateTenantSettings(_tenantId: string, data: unknown): Promise<SettingsActionResult> {
  try {
    const user = await requireRole("OWNER");
    const tenantPrisma = await requireTenantPrisma();
    const tenantId = user.tenantId;
    
    const parsedResult = SettingsSchema.safeParse(data);
    if (!parsedResult.success) {
      return {
        success: false,
        error: parsedResult.error.issues[0]?.message ?? "Data pengaturan tidak valid.",
      };
    }
    const parsed = parsedResult.data;

    const updatedTenant = await tenantPrisma.$transaction(async (tx) => {
      const updated = await tx.tenant.update({
        where: { id: tenantId },
        data: {
          name: parsed.name,
          timezone: parsed.timezone,
          themeColor: parsed.themeColor,
          heroText: parsed.heroText,
          logoUrl: parsed.logoUrl,
          heroImageUrl: parsed.heroImageUrl,
          layoutStyle: parsed.layoutStyle,
          whatsappNumber: parsed.whatsappNumber,
          aboutText: parsed.aboutText,
          catalogTitle: parsed.catalogTitle,
          catalogSubtitle: parsed.catalogSubtitle,
          footerText: parsed.footerText,
          midtransClientKey: parsed.midtransClientKey,
          midtransServerKey: parsed.midtransServerKey
            ? encryptCredential(parsed.midtransServerKey)
            : undefined,
          midtransIsProduction: parsed.midtransIsProduction,
          isArtisanEnabled: parsed.isArtisanEnabled,
          backgroundImageUrl: parsed.backgroundImageUrl,
          contactEmail: parsed.contactEmail,
          instagramHandle: parsed.instagramHandle,
          fontFamily: parsed.fontFamily,
          themeMode: parsed.themeMode,
          borderRadius: parsed.borderRadius,
          animationStyle: parsed.animationStyle,
          animationDirection: parsed.animationDirection,
          iconStyle: parsed.iconStyle,
          themeConfig: parsed.themeConfig as Prisma.InputJsonValue | undefined,
          problemStatement: parsed.problemStatement,
          solutionStatement: parsed.solutionStatement,
          uspText: parsed.uspText,
          features: parsed.features,
          testimonials: parsed.testimonials,
          faqs: parsed.faqs,
        },
      });

      await recordAudit(tx, {
        tenantId,
        userId: user.id,
        action: "UPDATE",
        entityType: "TenantSettings",
        entityId: tenantId,
        metadata: {
          changedFields: Object.keys(parsed).filter(
            (key) => !["midtransClientKey", "midtransServerKey"].includes(key),
          ),
          paymentCredentialsChanged:
            parsed.midtransClientKey !== undefined ||
            parsed.midtransServerKey !== undefined,
        },
      });

      return updated;
    });

    revalidatePath("/settings");
    revalidatePath(`/tenant/${updatedTenant.subdomain}`);
    return { success: true };
  } catch (err) {
    console.error("[updateTenantSettings]", err);
    return { success: false, error: "Gagal menyimpan pengaturan. Coba lagi." };
  }
}
