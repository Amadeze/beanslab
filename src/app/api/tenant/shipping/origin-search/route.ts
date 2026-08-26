import { NextRequest, NextResponse } from "next/server";

import {
  digestIdentifier,
  layeredIdentifiers,
  resolveClientIdentity,
} from "@/lib/client-identity";
import { requireRole, requireTenantPrisma } from "@/lib/auth";
import { isNextRedirectError } from "@/lib/api-auth";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { getRequestId, internalErrorResponse, logServerError } from "@/lib/api-observability";
import { getRajaOngkirClientConfig } from "@/lib/shipping/platform-integration";
import { searchDomesticDestination } from "@/lib/shipping/providers/rajaongkir";
import { ShippingProviderError } from "@/lib/shipping/errors";
import { RAJAONGKIR_DESTINATION_MIN_QUERY } from "@/lib/shipping/types";
import { createOriginSelectionToken, destinationToPayload } from "@/lib/shipping/origin-token";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req.headers);
  const identity = resolveClientIdentity(req.headers);

  let user;
  try {
    user = await requireRole("OWNER");
  } catch (error) {
    // requireRole melempar NEXT_REDIRECT saat sesi tidak valid — konversi
    // ke 403 agar API tidak menjawab 307.
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    throw error;
  }
  try {
    await requireTenantPrisma();
  } catch (error) {
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    throw error;
  }

  try {
    await enforceRateLimit({
      scope: "tenant-shipping-origin-search",
      identifiers: layeredIdentifiers(identity, [
        digestIdentifier("tenant", user.tenantId),
      ]),
      limit: 30,
      windowSeconds: 10 * 60,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: { "Retry-After": String(error.retryAfter) } },
      );
    }
    throw error;
  }

  let body: { query?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (query.length < RAJAONGKIR_DESTINATION_MIN_QUERY) {
    return NextResponse.json(
      { error: `Query minimal ${RAJAONGKIR_DESTINATION_MIN_QUERY} karakter.` },
      { status: 400 },
    );
  }

  try {
    const config = await getRajaOngkirClientConfig();
    const destinations = await searchDomesticDestination(query, config, { limit: 20 });
    const results = destinations.map((d) => ({
      ...d,
      token: createOriginSelectionToken(destinationToPayload(d)),
    }));
    return NextResponse.json({ results }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ShippingProviderError) {
      if (error.code === "INTEGRATION_DISABLED" || error.code === "MISSING_CREDENTIAL") {
        return NextResponse.json(
          { results: [], integrationDisabled: true },
          { status: 200, headers: { "Cache-Control": "no-store" } },
        );
      }
      // Controlled, key-free error surfaced to the client.
      return NextResponse.json(
        { results: [], error: error.code },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }
    logServerError("tenant.shipping.origin-search", error, { requestId, tenantId: user.tenantId });
    return internalErrorResponse(requestId);
  }
}
