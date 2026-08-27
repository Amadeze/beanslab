export type ProviderDeliveryResult =
  | { success: true }
  | { success: false; error: string };

export function normalizeWhatsAppTarget(phone: string): string | null {
  let normalized = phone.replace(/[^\d+]/g, "");
  if (normalized.startsWith("+")) normalized = normalized.slice(1);
  if (normalized.startsWith("0")) normalized = `62${normalized.slice(1)}`;
  return /^\d{8,15}$/.test(normalized) ? normalized : null;
}

export function interpretFonnteResponse(
  responseOk: boolean,
  responseStatus: number,
  body: string,
): ProviderDeliveryResult {
  if (!responseOk) {
    return { success: false, error: `Fonnte HTTP ${responseStatus}: ${body.slice(0, 300)}` };
  }
  try {
    const payload = JSON.parse(body) as { status?: boolean; reason?: string; detail?: string };
    if (payload.status === true) return { success: true };
    return {
      success: false,
      error: `Fonnte menolak pesan: ${payload.reason || payload.detail || "respons tidak dikenali"}`,
    };
  } catch {
    return { success: false, error: `Respons Fonnte tidak valid: ${body.slice(0, 300)}` };
  }
}
