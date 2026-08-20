// RajaOngkir / Komerce shipping cost provider.
//
// Server-only. The caller supplies a DECRYPTED apiKey (resolved from the global
// PlatformIntegration store). This module normalizes untrusted provider
// responses into Roastd-owned types and never leaks the API key, raw provider
// body, or secret material into errors, logs, or results.

import { ShippingProviderError } from "../errors";
import {
  RAJAONGKIR_BASE_URL,
  RAJAONGKIR_REQUEST_TIMEOUT_MS,
} from "../rajaongkir-config";
import {
  type RajaOngkirCostInput,
  RAJAONGKIR_DESTINATION_MIN_QUERY,
  RAJAONGKIR_DEFAULT_DESTINATION_LIMIT,
  RAJAONGKIR_MAX_DESTINATION_LIMIT,
  type RajaOngkirDestination,
  type RajaOngkirDestinationQueryOptions,
  type RajaOngkirRateService,
  type RajaOngkirTrackInput,
  type RajaOngkirWaybillSummary,
} from "../types";

export interface RajaOngkirClientConfig {
  apiKey: string;
  fetchImpl?: typeof fetch;
}

function resolveFetch(config: RajaOngkirClientConfig): typeof fetch {
  return config.fetchImpl ?? fetch;
}

function buildHeaders(apiKey: string): Record<string, string> {
  return {
    key: apiKey,
    Accept: "application/json",
  };
}

interface RawDestination {
  id?: string | number;
  province?: string;
  city?: string;
  district?: string;
  subdistrict?: string;
  postal_code?: string;
  postalCode?: string;
  location_type?: string;
}

function buildDestinationLabel(d: RawDestination): string {
  const parts = [
    d.subdistrict,
    d.district,
    d.city,
    d.province,
    d.postal_code ?? d.postalCode,
  ]
    .filter(Boolean)
    .map((s) => String(s).trim())
    .filter(Boolean);
  return parts.join(", ");
}

function normalizeDestination(raw: RawDestination): RajaOngkirDestination | null {
  const id = raw.id != null ? String(raw.id) : "";
  if (!id) return null;
  const postal = raw.postal_code ?? raw.postalCode;
  return {
    providerId: id,
    label: buildDestinationLabel(raw) || id,
    province: raw.province?.trim() || undefined,
    city: raw.city?.trim() || undefined,
    district: raw.district?.trim() || undefined,
    subdistrict: raw.subdistrict?.trim() || undefined,
    postalCode: postal?.trim() || undefined,
  };
}

async function requestJson(
  config: RajaOngkirClientConfig,
  path: string,
  init: RequestInit,
): Promise<unknown> {
  const fetchImpl = resolveFetch(config);
  const baseUrl = RAJAONGKIR_BASE_URL.replace(/\/+$/, "");
  const url = `${baseUrl}${path}`;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      ...init,
      headers: {
        ...buildHeaders(config.apiKey),
        ...(init.headers ?? {}),
      },
      signal: init.signal ?? AbortSignal.timeout(RAJAONGKIR_REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new ShippingProviderError(
        "PROVIDER_TIMEOUT",
        "Provider request timed out.",
        { retryable: true },
      );
    }
    throw new ShippingProviderError(
      "PROVIDER_UNEXPECTED",
      "Provider request failed.",
      { retryable: true },
    );
  }

  if (response.status === 401) {
    throw new ShippingProviderError(
      "PROVIDER_UNAUTHORIZED",
      "Provider rejected the credential.",
    );
  }
  if (response.status === 429) {
    throw new ShippingProviderError(
      "PROVIDER_RATE_LIMITED",
      "Provider rate limit reached.",
      { status: 429, retryable: true },
    );
  }
  if (response.status >= 500) {
    throw new ShippingProviderError(
      "PROVIDER_SERVER_ERROR",
      "Provider unavailable.",
      { status: response.status, retryable: true },
    );
  }
  if (response.status >= 400) {
    throw new ShippingProviderError(
      "PROVIDER_BAD_REQUEST",
      "Provider rejected the request.",
      { status: response.status },
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ShippingProviderError(
      "PROVIDER_INVALID_RESPONSE",
      "Provider returned an unparseable response.",
    );
  }
  return body;
}

function extractDataArray(body: unknown): unknown[] {
  if (body && typeof body === "object") {
    const candidate = (body as Record<string, unknown>).data;
    if (Array.isArray(candidate)) return candidate;
    const rajaongkir = (body as Record<string, unknown>).rajaongkir;
    if (rajaongkir && typeof rajaongkir === "object") {
      const nested = (rajaongkir as Record<string, unknown>).data;
      if (Array.isArray(nested)) return nested;
    }
  }
  return [];
}

export async function searchDomesticDestination(
  query: string,
  config: RajaOngkirClientConfig,
  options: RajaOngkirDestinationQueryOptions = {},
): Promise<RajaOngkirDestination[]> {
  const trimmed = query.trim();
  if (trimmed.length < RAJAONGKIR_DESTINATION_MIN_QUERY) {
    throw new ShippingProviderError(
      "PROVIDER_BAD_REQUEST",
      `Search query must be at least ${RAJAONGKIR_DESTINATION_MIN_QUERY} characters.`,
    );
  }

  const limit = Math.min(
    Math.max(options.limit ?? RAJAONGKIR_DEFAULT_DESTINATION_LIMIT, 1),
    RAJAONGKIR_MAX_DESTINATION_LIMIT,
  );
  const offset = Math.max(options.offset ?? 0, 0);

  const searchParams = new URLSearchParams({
    search: trimmed,
    limit: String(limit),
    offset: String(offset),
  });

  const body = await requestJson(
    config,
    `/destination/domestic-destination?${searchParams.toString()}`,
    { method: "GET" },
  );

  const rawList = extractDataArray(body) as RawDestination[];
  const destinations = rawList
    .map(normalizeDestination)
    .filter((d): d is RajaOngkirDestination => d !== null);

  if (destinations.length === 0) {
    throw new ShippingProviderError(
      "PROVIDER_EMPTY_RESULT",
      "No destination matched the search.",
    );
  }
  return destinations;
}

/**
 * Resolves and re-validates a single provider destination by its canonical
 * provider id. Used by the tenant shipping-settings save path so the persisted
 * origin snapshot is always derived from server-validated provider data (never
 * from client-submitted hidden inputs). Throws when the id does not resolve to a
 * real RajaOngkir location.
 */
export async function resolveDomesticDestination(
  providerId: string,
  config: RajaOngkirClientConfig,
  options: RajaOngkirDestinationQueryOptions = {},
): Promise<RajaOngkirDestination> {
  const trimmed = providerId.trim();
  if (trimmed.length < RAJAONGKIR_DESTINATION_MIN_QUERY) {
    throw new ShippingProviderError(
      "PROVIDER_BAD_REQUEST",
      "Provider destination id is invalid.",
    );
  }

  const candidates = await searchDomesticDestination(trimmed, config, {
    limit: RAJAONGKIR_MAX_DESTINATION_LIMIT,
    ...options,
  });
  const match = candidates.find((d) => d.providerId === trimmed);
  if (!match) {
    throw new ShippingProviderError(
      "PROVIDER_EMPTY_RESULT",
      "Lokasi asal tidak ditemukan di RajaOngkir.",
    );
  }
  return match;
}

export async function calculateDomesticCost(
  input: RajaOngkirCostInput,
  config: RajaOngkirClientConfig,
): Promise<RajaOngkirRateService[]> {
  const weight = Number(input.weight);
  if (!input.origin || !input.destination || !input.courier) {
    throw new ShippingProviderError(
      "PROVIDER_BAD_REQUEST",
      "Origin, destination, and courier are required.",
    );
  }
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new ShippingProviderError(
      "PROVIDER_BAD_REQUEST",
      "Weight must be a positive number of grams.",
    );
  }

  const form = new URLSearchParams({
    origin: String(input.origin),
    destination: String(input.destination),
    weight: String(Math.round(weight)),
    courier: String(input.courier),
  });
  if (input.price != null && Number.isFinite(input.price)) {
    form.set("price", String(input.price));
  }

  const body = await requestJson(config, "/calculate/domestic-cost", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  const rawList = extractDataArray(body) as Array<{
    code?: string;
    name?: string;
    costs?: Array<{
      service?: string;
      description?: string;
      cost?: Array<{ value?: number; etd?: string; note?: string }>;
    }>;
  }>;

  const services: RajaOngkirRateService[] = [];
  for (const courier of rawList) {
    const courierCode = (courier.code ?? "").trim();
    const courierName = (courier.name ?? "").trim() || courierCode;
    if (!courierCode) continue;
    for (const option of courier.costs ?? []) {
      const serviceCode = (option.service ?? "").trim();
      if (!serviceCode) continue;
      const firstCost = option.cost?.[0];
      const costValue = Number(firstCost?.value ?? 0);
      if (!Number.isFinite(costValue)) continue;
      services.push({
        courierCode,
        courierName,
        serviceCode,
        serviceName: option.description?.trim() || undefined,
        description: firstCost?.note?.trim() || undefined,
        cost: Math.round(costValue),
        etd: firstCost?.etd?.trim() || undefined,
      });
    }
  }

  if (services.length === 0) {
    throw new ShippingProviderError(
      "PROVIDER_EMPTY_RESULT",
      "No shipping rates returned.",
    );
  }
  return services;
}

export async function trackWaybill(
  input: RajaOngkirTrackInput,
  config: RajaOngkirClientConfig,
): Promise<RajaOngkirWaybillSummary> {
  if (!input.awb || !input.courier) {
    throw new ShippingProviderError(
      "PROVIDER_BAD_REQUEST",
      "AWB and courier are required for tracking.",
    );
  }

  const form = new URLSearchParams({
    awb: String(input.awb),
    courier: String(input.courier),
  });
  if (input.lastPhoneNumber) {
    form.set("last_phone_number", String(input.lastPhoneNumber));
  }

  const body = await requestJson(config, "/track/waybill", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  const data =
    body && typeof body === "object"
      ? ((body as Record<string, unknown>).data ?? body)
      : {};

  const summary =
    data && typeof data === "object" && (data as Record<string, unknown>).summary &&
    typeof (data as Record<string, unknown>).summary === "object"
      ? ((data as Record<string, unknown>).summary as Record<string, unknown>)
      : (data as Record<string, unknown>);

  const status =
    typeof summary.status === "string"
      ? String(summary.status)
      : typeof (data as Record<string, unknown>).status === "string"
        ? String((data as Record<string, unknown>).status)
        : undefined;
  const deliveredFlag =
    typeof summary.delivered === "boolean"
      ? Boolean(summary.delivered)
      : typeof (data as Record<string, unknown>).delivered === "boolean"
        ? Boolean((data as Record<string, unknown>).delivered)
        : undefined;

  return {
    awb: String(input.awb),
    courier: String(input.courier),
    status,
    delivered: deliveredFlag,
  };
}
