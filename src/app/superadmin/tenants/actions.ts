"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { requireRole } from "@/lib/auth";
import {
  createPasswordResetToken,
  hashPasswordResetToken,
} from "@/lib/password-reset";
import { sendPasswordResetEmail } from "@/lib/notifications";
import { isReservedTenantSubdomain } from "@/lib/tenant-host";
import { recordAudit } from "@/lib/audit";
import { encryptCredential } from "@/lib/credentials";
import { enforceRateLimit } from "@/lib/rate-limit";
import { validateMidtransSupportInput } from "@/lib/tenant-integration-support";
import { z } from "zod";

const MidtransSupportSchema = z.object({
  tenantId: z.string().min(1),
  clientKey: z.string().trim().max(255).optional(),
  serverKey: z.string().trim().max(255).optional(),
  isProduction: z.boolean(),
}).strict();

export async function createTenant(data: {
  code: string;
  name: string;
  subdomain: string;
  adminName: string;
  adminEmail: string;
}) {
  try {
    const admin = await requireRole("SUPERADMIN");

    // Basic validation
    if (!data.code || !data.name || !data.subdomain || !data.adminEmail || !data.adminName) {
      return { success: false, error: "Semua field harus diisi." };
    }

    const cleanSubdomain = data.subdomain.toLowerCase().trim();
    const cleanCode = data.code.toUpperCase().trim();
    const cleanEmail = data.adminEmail.toLowerCase().trim();
    if (
      cleanSubdomain.length < 3 ||
      cleanSubdomain.length > 40 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSubdomain)
    ) {
      return { success: false, error: "Format subdomain tidak valid." };
    }
    if (isReservedTenantSubdomain(cleanSubdomain)) {
      return { success: false, error: "Subdomain tersebut dicadangkan oleh sistem." };
    }
    if (!/^[A-Z0-9-]{3,30}$/.test(cleanCode)) {
      return { success: false, error: "Kode outlet hanya boleh berisi huruf, angka, dan tanda hubung." };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return { success: false, error: "Email admin tidak valid." };
    }

    // Check existing
    const existingTenant = await prisma.tenant.findFirst({
      where: {
        OR: [{ code: cleanCode }, { subdomain: cleanSubdomain }],
      },
    });

    if (existingTenant) {
      return { success: false, error: "Kode Outlet atau Subdomain sudah digunakan." };
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existingUser) {
      return { success: false, error: "Email Admin sudah terdaftar di sistem." };
    }

    const setupToken = createPasswordResetToken();
    const hashedPassword = await bcrypt.hash(createPasswordResetToken(), 12);
    const trialEndsAt = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);

    // Create Tenant and Admin User
    const owner = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          code: cleanCode,
          name: data.name.trim(),
          subdomain: cleanSubdomain,
          subscriptionTier: "TRIAL",
          subscriptionStatus: "ACTIVE",
          trialEndsAt,
        },
      });

      const user = await tx.user.create({
        data: {
          name: data.adminName.trim(),
          email: cleanEmail,
          password: hashedPassword,
          role: "OWNER",
          tenantId: tenant.id,
        },
      });

      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashPasswordResetToken(setupToken),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      await recordAudit(tx, {
        tenantId: tenant.id,
        userId: admin.id,
        action: "CREATE",
        entityType: "Tenant",
        entityId: tenant.id,
        after: {
          code: tenant.code,
          name: tenant.name,
          subdomain: tenant.subdomain,
          subscriptionTier: tenant.subscriptionTier,
        },
        metadata: { source: "SUPERADMIN" },
      });
      return user;
    });

    const appUrl = process.env.APP_URL;
    if (!appUrl) throw new Error("APP_URL environment variable is required");
    const emailResult = await sendPasswordResetEmail(
      owner.email,
      owner.name,
      `${appUrl}/reset-password?token=${encodeURIComponent(setupToken)}`,
    );

    revalidatePath("/superadmin/tenants");
    return {
      success: true,
      emailSent: emailResult.success && !("mocked" in emailResult),
    };
  } catch (error: any) {
    console.error("Create Tenant Error:", error);
    return { success: false, error: error.message || "Gagal membuat tenant." };
  }
}

export async function updateTenantAdmin(data: {
  id: string;
  isActive: boolean;
  subscriptionTier: "TRIAL" | "BASIC" | "PRO" | "ENTERPRISE";
  subscriptionStatus: "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED";
}) {
  try {
    const admin = await requireRole("SUPERADMIN");
    if (!data.id) return { success: false, error: "Tenant ID is required." };

    await prisma.$transaction(async (tx) => {
      const before = await tx.tenant.findFirst({
        where: { id: data.id, NOT: { id: "default" } },
        select: { id: true, isActive: true, subscriptionTier: true, subscriptionStatus: true },
      });
      if (!before) throw new Error("Tenant tidak ditemukan.");

      const after = await tx.tenant.update({
        where: { id: data.id },
        data: {
          isActive: data.isActive,
          subscriptionTier: data.subscriptionTier,
          subscriptionStatus: data.subscriptionStatus,
        },
        select: { isActive: true, subscriptionTier: true, subscriptionStatus: true },
      });
      await recordAudit(tx, {
        tenantId: data.id,
        userId: admin.id,
        action: "UPDATE",
        entityType: "Tenant",
        entityId: data.id,
        before,
        after,
        metadata: { source: "SUPERADMIN" },
      });
    });

    revalidatePath("/superadmin/tenants");
    revalidatePath(`/superadmin/tenants/${data.id}`);
    revalidatePath("/superadmin/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("Update Tenant Error:", error);
    return { success: false, error: error.message || "Gagal mengupdate tenant." };
  }
}

export async function extendTenantTrial(data: { tenantId: string; days: 7 | 14 | 30 }) {
  try {
    const admin = await requireRole("SUPERADMIN");
    if (!data.tenantId || ![7, 14, 30].includes(data.days)) {
      return { success: false, error: "Durasi perpanjangan trial tidak valid." };
    }

    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findFirst({
        where: { id: data.tenantId, NOT: { id: "default" } },
        select: { id: true, subscriptionTier: true, subscriptionStatus: true, trialEndsAt: true },
      });
      if (!tenant) throw new Error("Tenant tidak ditemukan.");
      if (tenant.subscriptionTier !== "TRIAL") {
        throw new Error("Perpanjangan hanya berlaku untuk tenant paket Trial.");
      }

      const now = new Date();
      const base = tenant.trialEndsAt && tenant.trialEndsAt > now ? tenant.trialEndsAt : now;
      const trialEndsAt = new Date(base.getTime() + data.days * 86_400_000);
      await tx.tenant.update({
        where: { id: tenant.id },
        data: { trialEndsAt, subscriptionStatus: "ACTIVE" },
      });
      await recordAudit(tx, {
        tenantId: tenant.id,
        userId: admin.id,
        action: "EXTEND_TRIAL",
        entityType: "Tenant",
        entityId: tenant.id,
        before: { trialEndsAt: tenant.trialEndsAt, subscriptionStatus: tenant.subscriptionStatus },
        after: { trialEndsAt, subscriptionStatus: "ACTIVE" },
        metadata: { source: "SUPERADMIN", days: data.days },
      });
      return trialEndsAt;
    });

    revalidatePath(`/superadmin/tenants/${data.tenantId}`);
    revalidatePath("/superadmin/tenants");
    revalidatePath("/superadmin/dashboard");
    revalidatePath("/superadmin/subscriptions");
    return { success: true, trialEndsAt: result.toISOString() };
  } catch (error) {
    console.error("Extend Trial Error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Trial gagal diperpanjang." };
  }
}

export async function updateTenantMidtransSupport(data: unknown) {
  try {
    const admin = await requireRole("SUPERADMIN");
    const parsed = MidtransSupportSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: "Data credential Midtrans tidak valid." };

    const input = parsed.data;
    const tenant = await prisma.tenant.findFirst({
      where: { id: input.tenantId, NOT: { id: "default" } },
      select: {
        id: true,
        midtransClientKey: true,
        midtransServerKey: true,
        midtransIsProduction: true,
      },
    });
    if (!tenant) return { success: false, error: "Tenant tidak ditemukan." };

    const validationError = validateMidtransSupportInput({
      clientKey: input.clientKey,
      serverKey: input.serverKey,
      isProduction: input.isProduction,
      environmentChanged: input.isProduction !== tenant.midtransIsProduction,
    });
    if (validationError) return { success: false, error: validationError };

    await prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: tenant.id },
        data: {
          midtransClientKey: input.clientKey || undefined,
          midtransServerKey: input.serverKey ? encryptCredential(input.serverKey) : undefined,
          midtransIsProduction: input.isProduction,
        },
      });
      await recordAudit(tx, {
        tenantId: tenant.id,
        userId: admin.id,
        action: "SUPPORT_UPDATE",
        entityType: "TenantMidtrans",
        entityId: tenant.id,
        metadata: {
          source: "SUPERADMIN_SUPPORT",
          clientKeyRotated: Boolean(input.clientKey),
          serverKeyRotated: Boolean(input.serverKey),
          environmentChanged: input.isProduction !== tenant.midtransIsProduction,
          environment: input.isProduction ? "PRODUCTION" : "SANDBOX",
        },
      });
    });

    revalidatePath(`/superadmin/tenants/${tenant.id}`);
    return { success: true };
  } catch (error) {
    console.error("Update tenant Midtrans support error:", error);
    return { success: false, error: "Credential Midtrans tidak dapat disimpan." };
  }
}

export async function sendTenantOwnerAccessLink(data: { tenantId: string }) {
  try {
    const admin = await requireRole("SUPERADMIN");
    if (!data.tenantId) return { success: false, error: "Tenant wajib dipilih." };
    const appUrl = process.env.APP_URL;
    if (!appUrl) return { success: false, error: "APP_URL belum dikonfigurasi." };
    await enforceRateLimit({
      scope: "superadmin-owner-access-link",
      identifiers: [`admin:${admin.id}`, `tenant:${data.tenantId}`],
      limit: 5,
      windowSeconds: 15 * 60,
    });

    const owner = await prisma.user.findFirst({
      where: { tenantId: data.tenantId, role: "OWNER", isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, tenantId: true },
    });
    if (!owner) return { success: false, error: "Owner aktif tidak ditemukan." };

    const token = createPasswordResetToken();
    const tokenHash = hashPasswordResetToken(token);
    await prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.deleteMany({
        where: { userId: owner.id, usedAt: null },
      });
      await tx.passwordResetToken.create({
        data: {
          userId: owner.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 30 * 60 * 1_000),
        },
      });
      await recordAudit(tx, {
        tenantId: owner.tenantId,
        userId: admin.id,
        action: "SUPPORT_ACCESS_LINK",
        entityType: "User",
        entityId: owner.id,
        metadata: { source: "SUPERADMIN_SUPPORT", expiresInMinutes: 30 },
      });
    });

    const delivery = await sendPasswordResetEmail(
      owner.email,
      owner.name,
      `${appUrl}/reset-password?token=${encodeURIComponent(token)}`,
    );
    if (!delivery.success) {
      await prisma.passwordResetToken.deleteMany({ where: { tokenHash } });
      return { success: false, error: "Email tautan akses gagal dikirim." };
    }

    revalidatePath(`/superadmin/tenants/${owner.tenantId}`);
    return { success: true };
  } catch (error) {
    console.error("Send tenant owner access link error:", error);
    return { success: false, error: "Tautan akses tidak dapat dikirim." };
  }
}
