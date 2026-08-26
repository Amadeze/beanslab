"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { requireRole, requireTenantPrisma } from "@/lib/auth";
import { isSupportedCourierCode } from "@/lib/shipping/rajaongkir-config";
import { RAJAONGKIR_TARE_MAX_GRAMS } from "@/lib/shipping/types";
import { verifyOriginSelectionToken } from "@/lib/shipping/origin-token";
import type { OriginSelectionPayload } from "@/lib/shipping/origin-token";

const optionalString = z
  .string()
  .trim()
  .max(160, "Teks terlalu panjang.")
  .nullish()
  .transform((value) => (value ? value : undefined));

const schema = z
  .object({
    pickupEnabled: z.boolean(),
    deliveryEnabled: z.boolean(),
    nationalCourierEnabled: z.boolean(),
    rajaOngkirOriginToken: optionalString,
    rajaOngkirOriginId: optionalString,
    rajaOngkirOriginLabel: optionalString,
    rajaOngkirOriginProvince: optionalString,
    rajaOngkirOriginCity: optionalString,
    rajaOngkirOriginDistrict: optionalString,
    rajaOngkirOriginSubdistrict: optionalString,
    rajaOngkirOriginPostalCode: optionalString,
    rajaOngkirOriginStreet: optionalString,
    rajaOngkirCourierCodes: z.array(z.string()),
    rajaOngkirTareGrams: z.coerce.number().int().min(0).max(RAJAONGKIR_TARE_MAX_GRAMS),
    flatShippingRate: z.coerce.number().min(0).max(1_000_000_000),
    freeShippingMinimum: z.union([z.coerce.number().positive(), z.null()]),
    taxRate: z.coerce.number().min(0).max(100),
    reservationMinutes: z.coerce.number().int().min(15).max(10_080),
  })
  .refine(
    (value) => value.pickupEnabled || value.deliveryEnabled || value.nationalCourierEnabled,
    { message: "Aktifkan minimal satu cara menerima pesanan." },
  )
  .refine(
    (value) =>
      !value.nationalCourierEnabled || value.rajaOngkirCourierCodes.length > 0,
    { message: "Pilih minimal satu kurir nasional yang diizinkan." },
  )
  .transform((value) => ({
    ...value,
    rajaOngkirCourierCodes: value.rajaOngkirCourierCodes.filter(isSupportedCourierCode),
  }));

export async function saveCommerceSettings(formData: FormData) {
  const user = await requireRole("OWNER");
  const tp = await requireTenantPrisma();

  const courierCodes = formData
    .getAll("rajaOngkirCourierCodes")
    .map((v) => String(v));

  const freeRaw = String(formData.get("freeShippingMinimum") ?? "").trim();
  const parsed = schema.safeParse({
    pickupEnabled: formData.get("pickupEnabled") === "on",
    deliveryEnabled: formData.get("deliveryEnabled") === "on",
    nationalCourierEnabled: formData.get("nationalCourierEnabled") === "on",
    rajaOngkirOriginToken: formData.get("rajaOngkirOriginToken"),
    rajaOngkirOriginLabel: formData.get("rajaOngkirOriginLabel"),
    rajaOngkirOriginProvince: formData.get("rajaOngkirOriginProvince"),
    rajaOngkirOriginCity: formData.get("rajaOngkirOriginCity"),
    rajaOngkirOriginDistrict: formData.get("rajaOngkirOriginDistrict"),
    rajaOngkirOriginSubdistrict: formData.get("rajaOngkirOriginSubdistrict"),
    rajaOngkirOriginPostalCode: formData.get("rajaOngkirOriginPostalCode"),
    rajaOngkirOriginStreet: formData.get("rajaOngkirOriginStreet"),
    rajaOngkirCourierCodes: courierCodes,
    rajaOngkirTareGrams: formData.get("rajaOngkirTareGrams"),
    flatShippingRate: formData.get("flatShippingRate"),
    freeShippingMinimum: freeRaw === "" ? null : formData.get("freeShippingMinimum"),
    taxRate: formData.get("taxRate"),
    reservationMinutes: formData.get("reservationMinutes"),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Pengaturan toko tidak valid." };
  }
const data = parsed.data;

  const before = await tp.tenant.findUnique({
    where: { id: user.tenantId },
    select: {
      storefrontPickupEnabled: true,
      storefrontDeliveryEnabled: true,
      storefrontFlatShippingRate: true,
      storefrontFreeShippingMinimum: true,
      storefrontTaxRate: true,
      storefrontReservationMinutes: true,
      nationalCourierEnabled: true,
      rajaOngkirOriginId: true,
      rajaOngkirOriginLabel: true,
      rajaOngkirOriginProvince: true,
      rajaOngkirOriginCity: true,
      rajaOngkirOriginDistrict: true,
      rajaOngkirOriginSubdistrict: true,
      rajaOngkirOriginPostalCode: true,
      rajaOngkirOriginStreet: true,
      rajaOngkirCourierCodes: true,
      rajaOngkirTareGrams: true,
    },
  });

  // Trust boundary: the persisted origin must derive from a server-issued
  // tamper-evident token, never from client-submitted hidden inputs.
  // The token is issued by the origin-search route and contains the
  // provider-normalized snapshot. We verify it here and persist only the
  // authenticated server payload. This runs outside the DB transaction
  // (no external HTTP/crypto inside Serializable transactions).
  const token = formData.get("rajaOngkirOriginToken");
  let resolvedOrigin: OriginSelectionPayload | null = null;
  if (typeof token === "string" && token.length > 0) {
    resolvedOrigin = await verifyOriginSelectionToken(token);
    if (!resolvedOrigin) {
      return { success: false, error: "Token asal pengiriman tidak valid atau kadaluwarsa. Pilih ulang lokasi asal." };
    }
  }

  if (data.nationalCourierEnabled && !resolvedOrigin && !before?.rajaOngkirOriginId) {
    return { success: false, error: "Pilih lokasi asal pengiriman untuk mengaktifkan kurir nasional." };
  }

  await tp.$transaction(async (tx) => {
    const updated = await tx.tenant.update({
      where: { id: user.tenantId },
      data: {
        storefrontPickupEnabled: data.pickupEnabled,
        storefrontDeliveryEnabled: data.deliveryEnabled,
        storefrontFlatShippingRate: data.flatShippingRate,
        storefrontFreeShippingMinimum:
          freeRaw === "" ? null : data.freeShippingMinimum,
        storefrontTaxRate: data.taxRate,
        storefrontReservationMinutes: data.reservationMinutes,
        nationalCourierEnabled: data.nationalCourierEnabled,
        rajaOngkirOriginId: resolvedOrigin ? resolvedOrigin.providerId : (before?.rajaOngkirOriginId ?? null),
        rajaOngkirOriginLabel: resolvedOrigin ? resolvedOrigin.label : (before?.rajaOngkirOriginLabel ?? null),
        rajaOngkirOriginProvince: resolvedOrigin ? resolvedOrigin.province : (before?.rajaOngkirOriginProvince ?? null),
        rajaOngkirOriginCity: resolvedOrigin ? resolvedOrigin.city : (before?.rajaOngkirOriginCity ?? null),
        rajaOngkirOriginDistrict: resolvedOrigin ? resolvedOrigin.district : (before?.rajaOngkirOriginDistrict ?? null),
        rajaOngkirOriginSubdistrict: resolvedOrigin ? resolvedOrigin.subdistrict : (before?.rajaOngkirOriginSubdistrict ?? null),
        rajaOngkirOriginPostalCode: resolvedOrigin ? resolvedOrigin.postalCode : (before?.rajaOngkirOriginPostalCode ?? null),
        rajaOngkirOriginStreet: data.rajaOngkirOriginStreet ?? null,
        rajaOngkirCourierCodes: data.rajaOngkirCourierCodes,
        rajaOngkirTareGrams: data.rajaOngkirTareGrams,
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
        nationalCourierEnabled: updated.nationalCourierEnabled,
        rajaOngkirOriginId: updated.rajaOngkirOriginId,
        rajaOngkirCourierCodes: updated.rajaOngkirCourierCodes,
        rajaOngkirTareGrams: updated.rajaOngkirTareGrams,
        flatShippingRate: Number(updated.storefrontFlatShippingRate),
        freeShippingMinimum:
          updated.storefrontFreeShippingMinimum === null
            ? null
            : Number(updated.storefrontFreeShippingMinimum),
        taxRate: Number(updated.storefrontTaxRate),
        reservationMinutes: updated.storefrontReservationMinutes,
      },
    });
  });
  revalidatePath("/settings/commerce");
  revalidatePath(`/tenant/${user.tenantId}`);
  return { success: true };
}
