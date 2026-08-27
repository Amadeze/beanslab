"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { requireRole, requireTenantPrisma } from "@/lib/auth";

const relativeOrAbsoluteUrl = z.union([
  z.string().url().max(2_048),
  z.string().startsWith("/").max(2_048),
]);

const PaymentMethodSchema = z.discriminatedUnion("method", [
  z.object({
    id: z.string().optional(),
    method: z.literal("TRANSFER"),
    label: z.string().trim().min(2).max(80),
    bankName: z.string().trim().min(2).max(80),
    accountNumber: z.string().trim().min(4).max(64),
    accountHolder: z.string().trim().min(2).max(120),
    qrisImageUrl: z.null().optional(),
    instructions: z.string().trim().max(500).nullable().optional(),
    requireProof: z.boolean().default(true),
  }),
  z.object({
    id: z.string().optional(),
    method: z.literal("QRIS"),
    label: z.string().trim().min(2).max(80),
    bankName: z.null().optional(),
    accountNumber: z.null().optional(),
    accountHolder: z.null().optional(),
    qrisImageUrl: relativeOrAbsoluteUrl,
    instructions: z.string().trim().max(500).nullable().optional(),
    requireProof: z.boolean().default(true),
  }),
]);

export type PaymentSettingsResult =
  | { success: true }
  | { success: false; error: string };

export async function saveTenantPaymentMethod(input: unknown): Promise<PaymentSettingsResult> {
  try {
    const user = await requireRole("OWNER");
    const tp = await requireTenantPrisma();
    const parsed = PaymentMethodSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Data pembayaran tidak valid." };
    }

    const { id, ...data } = parsed.data;
    await tp.$transaction(async (tx) => {
      const before = id
        ? await tx.tenantPaymentMethod.findUnique({ where: { id } })
        : null;
      if (id && !before) throw new Error("Metode pembayaran tidak ditemukan.");

      const saved = id
        ? await tx.tenantPaymentMethod.update({
            where: { id },
            data: { ...data, provider: "MANUAL" },
          })
        : await tx.tenantPaymentMethod.create({
            data: { ...data, provider: "MANUAL", tenantId: user.tenantId },
          });

      await recordAudit(tx, {
        tenantId: user.tenantId,
        userId: user.id,
        action: id ? "UPDATE" : "CREATE",
        entityType: "TenantPaymentMethod",
        entityId: saved.id,
        before: before ? { label: before.label, method: before.method, isActive: before.isActive } : undefined,
        after: { label: saved.label, method: saved.method, isActive: saved.isActive },
      });
    });

    revalidatePath("/settings/payments");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Gagal menyimpan metode pembayaran." };
  }
}

export async function setTenantPaymentMethodActive(id: string, isActive: boolean): Promise<PaymentSettingsResult> {
  try {
    const user = await requireRole("OWNER");
    const tp = await requireTenantPrisma();
    const updated = await tp.tenantPaymentMethod.update({ where: { id }, data: { isActive } });
    await recordAudit(tp, {
      tenantId: user.tenantId,
      userId: user.id,
      action: "UPDATE",
      entityType: "TenantPaymentMethod",
      entityId: id,
      after: { isActive, label: updated.label },
    });
    revalidatePath("/settings/payments");
    return { success: true };
  } catch {
    return { success: false, error: "Gagal mengubah status metode pembayaran." };
  }
}

export async function deleteTenantPaymentMethod(id: string): Promise<PaymentSettingsResult> {
  try {
    const user = await requireRole("OWNER");
    const tp = await requireTenantPrisma();
    await tp.$transaction(async (tx) => {
      const method = await tx.tenantPaymentMethod.findUnique({ where: { id } });
      if (!method) throw new Error("Metode pembayaran tidak ditemukan.");
      await tx.tenantPaymentMethod.delete({ where: { id } });
      await recordAudit(tx, {
        tenantId: user.tenantId,
        userId: user.id,
        action: "DELETE",
        entityType: "TenantPaymentMethod",
        entityId: id,
        before: { label: method.label, method: method.method },
      });
    });
    revalidatePath("/settings/payments");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Gagal menghapus metode pembayaran." };
  }
}
