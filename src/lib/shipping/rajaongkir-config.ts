// RajaOngkir / Komerce provider configuration.
// The base URL is application/provider configuration — NOT user-editable.

export const RAJAONGKIR_BASE_URL = "https://rajaongkir.komerce.id/api/v1/";

export const RAJAONGKIR_REQUEST_TIMEOUT_MS = 15_000;

// Curated national courier codes exposed to tenants. RajaOngkir is the
// provider abstraction — we do NOT build per-courier tables or integrations.
export const SUPPORTED_COURIERS = [
  { code: "jne", name: "JNE" },
  { code: "pos", name: "POS Indonesia" },
  { code: "tiki", name: "TIKI" },
  { code: "jnt", name: "J&T Express" },
  { code: "sicepat", name: "SiCepat" },
  { code: "ninja", name: "Ninja Xpress" },
  { code: "anteraja", name: "AnterAja" },
  { code: "lion", name: "Lion Parcel" },
] as const;

export type SupportedCourierCode = (typeof SUPPORTED_COURIERS)[number]["code"];

const SUPPORTED_COURIER_CODE_SET = new Set<string>(
  SUPPORTED_COURIERS.map((c) => c.code),
);

export function isSupportedCourierCode(code: string): code is SupportedCourierCode {
  return SUPPORTED_COURIER_CODE_SET.has(code);
}

export function getSupportedCourierName(code: string): string | undefined {
  return SUPPORTED_COURIERS.find((c) => c.code === code)?.name;
}
