// Tracking normalization — transforms raw RajaOngkir provider responses into
// a stable internal shape. Provider response shapes are NEVER leaked outside
// this boundary.

export interface TrackingEvent {
  timestamp: string | null;
  description: string;
  location: string | null;
  status: string | null;
}

export interface NormalizedTracking {
  awb: string;
  courierCode: string;
  providerStatus: string | null;
  providerDelivered: boolean;
  events: TrackingEvent[];
  lastRefreshedAt: string; // ISO 8601
}

/**
 * Normalize the raw RajaOngkir tracking response into a stable internal shape.
 *
 * The provider returns `{ data: { summary: {...}, details: [...] } }` where
 * `details` is an array of tracking events with varying field names depending
 * on the courier. This function normalizes the most common shapes without
 * leaking provider internals.
 */
export function normalizeTrackingEvent(
  raw: Record<string, unknown>,
): TrackingEvent {
  const timestamp =
    typeof raw.timestamp === "string"
      ? raw.timestamp
      : typeof raw.date === "string"
        ? raw.date
        : typeof raw.created_at === "string"
          ? raw.created_at
          : null;

  const description =
    typeof raw.description === "string"
      ? raw.description
      : typeof raw.desc === "string"
        ? raw.desc
        : typeof raw.note === "string"
          ? raw.note
          : typeof raw.status === "string"
            ? String(raw.status)
            : "";

  const location =
    typeof raw.location === "string"
      ? raw.location
      : typeof raw.city === "string"
        ? raw.city
        : typeof raw.division === "string"
          ? raw.division
          : null;

  const status =
    typeof raw.status === "string"
      ? String(raw.status)
      : typeof raw.code === "string"
        ? String(raw.code)
        : null;

  return { timestamp, description, location, status };
}

export function normalizeTrackingResponse(
  awb: string,
  courierCode: string,
  providerData: Record<string, unknown>,
): NormalizedTracking {
  const summary =
    providerData.summary &&
    typeof providerData.summary === "object"
      ? (providerData.summary as Record<string, unknown>)
      : providerData;

  const providerStatus =
    typeof summary.status === "string"
      ? summary.status
      : typeof providerData.status === "string"
        ? providerData.status
        : null;

  const providerDelivered =
    typeof summary.delivered === "boolean"
      ? summary.delivered
      : typeof providerData.delivered === "boolean"
        ? providerData.delivered
        : false;

  // Extract details/events array from provider response
  const rawDetails: unknown[] =
    Array.isArray(providerData.details)
      ? providerData.details
      : Array.isArray((providerData as Record<string, unknown>).history)
        ? (providerData as Record<string, unknown>).history as unknown[]
        : Array.isArray(summary.details)
          ? (summary.details as unknown[])
          : [];

  const events: TrackingEvent[] = rawDetails
    .filter((d): d is Record<string, unknown> =>
      typeof d === "object" && d !== null,
    )
    .map(normalizeTrackingEvent);

  return {
    awb,
    courierCode,
    providerStatus,
    providerDelivered,
    events,
    lastRefreshedAt: new Date().toISOString(),
  };
}
