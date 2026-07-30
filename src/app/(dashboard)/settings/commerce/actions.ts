"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { requireRole, requireTenantPrisma } from "@/lib/auth";

const schema = z.object({
  pickupEnabled: z.boolean(),
  deliveryEnabled: z.boolean(),
  flatShippingRate: z.coerce.number().min(0).max(1_000_000_000),
  freeShippingMinimum: z.union([z.coerce.number().positive(), z.null()]),
  taxRate: z.coerce.number().min(0).max(100),
  reservationMinutes: z.coerce.number().int().min(15).max(10_080),
}).refine((value) => value.pickupEnabled || value.deliveryEnabled, {
  message: "Aktifkan minimal satu cara menerima pesanan.",
});

export async function saveCommerceSettings(formData: FormData) {
  const user = await requireRole("OWNER");
  const tp = await requireTenantPrisma();
  const freeValue = String(formData.get("freeShippingMinimum") ?? "").trim();
  const parsed = schema.safeParse({
    pickupEnabled: formData.get("pickupEnabled") === "on",
    deliveryEnabled: formData.get("deliveryEnabled") === "on",
    flatShippingRate: formData.get("flatShippingRate"),
    freeShippingMinimum: freeValue === "" ? null : freeValue,
    taxRate: formData.get("taxRate"),
    reservationMinutes: formData.get("reservationMinutes"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Pengaturan toko tidak valid.");

  await tp.$transaction(async (tx) => {
    const before = await tx.tenant.findUnique({
      where: { id: user.tenantId },
      select: {
        storefrontPickupEnabled: true, storefrontDeliveryEnabled: true,
        storefrontFlatShippingRate: true, storefrontFreeShippingMinimum: true,
        storefrontTaxRate: true, storefrontReservationMinutes: true,
      },
    });
    const updated = await tx.tenant.update({
      where: { id: user.tenantId },
      data: {
        storefrontPickupEnabled: parsed.data.pickupEnabled,
        storefrontDeliveryEnabled: parsed.data.deliveryEnabled,
        storefrontFlatShippingRate: parsed.data.flatShippingRate,
        storefrontFreeShippingMinimum: parsed.data.freeShippingMinimum,
        storefrontTaxRate: parsed.data.taxRate,
        storefrontReservationMinutes: parsed.data.reservationMinutes,
      },
    });
    await recordAudit(tx, {
      tenantId: user.tenantId,
      userId: user.id,
      action: "UPDATE",
      entityType: "StorefrontCommerceSettings",
      entityId: user.tenantId,
      before: before ?? undefined,
      after: {
        pickupEnabled: updated.storefrontPickupEnabled,
        deliveryEnabled: updated.storefrontDeliveryEnabled,
        flatShippingRate: Number(updated.storefrontFlatShippingRate),
        freeShippingMinimum: updated.storefrontFreeShippingMinimum === null ? null : Number(updated.storefrontFreeShippingMinimum),
        taxRate: Number(updated.storefrontTaxRate),
        reservationMinutes: updated.storefrontReservationMinutes,
      },
    });
  });
  revalidatePath("/settings/commerce");
  revalidatePath(`/tenant/${user.tenantId}`);
}
