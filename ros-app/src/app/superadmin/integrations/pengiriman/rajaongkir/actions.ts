"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { ShippingProviderError } from "@/lib/shipping/errors";
import {
  getRajaOngkirClientConfig,
  recordRajaOngkirConnectionResult,
  upsertRajaOngkirApiKey,
} from "@/lib/shipping/platform-integration";
import { searchDomesticDestination } from "@/lib/shipping/providers/rajaongkir";

const PATH = "/superadmin/integrations/pengiriman/rajaongkir";

export type RajaOngkirSaveResult =
  | { success: true }
  | { success: false; error: string };

export type RajaOngkirTestResult =
  | { success: true; status: string }
  | { success: false; status: string; error: string };

const apiKeySchema = z
  .string()
  .trim()
  .min(10, "API Key terlalu pendek.")
  .max(256, "API Key terlalu panjang.");

export async function saveRajaOngkirApiKey(
  formData: FormData,
): Promise<RajaOngkirSaveResult> {
  await requireRole("SUPERADMIN");

  const parsed = apiKeySchema.safeParse(formData.get("apiKey"));
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "API Key tidak valid." };
  }

  try {
    await upsertRajaOngkirApiKey(parsed.data);
  } catch (error) {
    if (error instanceof ShippingProviderError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Gagal menyimpan API Key." };
  }

  revalidatePath(PATH);
  return { success: true };
}

export async function testRajaOngkirConnection(): Promise<RajaOngkirTestResult> {
  await requireRole("SUPERADMIN");

  try {
    const config = await getRajaOngkirClientConfig();
    // Safe, lightweight request: a benign destination search proves the key
    // decrypts, the provider accepts the credential, and the response contract
    // is parseable. No shipment is created and nothing is charged.
    await searchDomesticDestination("Jakarta", config, { limit: 1 });
    await recordRajaOngkirConnectionResult("OK");
    revalidatePath(PATH);
    return { success: true, status: "OK" };
  } catch (error) {
    const message =
      error instanceof ShippingProviderError
        ? error.message
        : "Koneksi gagal karena kesalahan tidak diketahui.";
    const status =
      error instanceof ShippingProviderError && error.code === "INTEGRATION_DISABLED"
        ? "FAILED"
        : "FAILED";
    await recordRajaOngkirConnectionResult("FAILED", message);
    revalidatePath(PATH);
    return { success: false, status, error: message };
  }
}
