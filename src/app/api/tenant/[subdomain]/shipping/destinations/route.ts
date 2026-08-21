import { NextRequest, NextResponse } from "next/server";

import {
  digestIdentifier,
  layeredIdentifiers,
  resolveClientIdentity,
} from "@/lib/client-identity";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { getRequestId, internalErrorResponse, logServerError } from "@/lib/api-observability";
import { prisma } from "@/lib/prisma";
import { getTenantAccessState } from "@/lib/subscription";
import { getRajaOngkirClientConfig } from "@/lib/shipping/platform-integration";
import { searchDomesticDestination } from "@/lib/shipping/providers/rajaongkir";
import { ShippingProviderError } from "@/lib/shipping/errors";
import { RAJAONGKIR_DESTINATION_MIN_QUERY } from "@/lib/shipping/types";
import { createOriginSelectionToken, destinationToPayload } from "@/lib/shipping/origin-token";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  const requestId = getRequestId(req.headers);
  const identity = resolveClientIdentity(req.headers);
  const { subdomain } = await params;
  let tenantId: string | undefined;

  try {
    // 1. Resolve tenant from subdomain (public storefront scope).
    const tenant = await prisma.tenant.findUnique({
      where: { subdomain },
      select: {
        id: true,
        subdomain: true,
        isActive: true,
        subscriptionStatus: true,
        subscriptionTier: true,
        trialEndsAt: true,
        nextBillingDate: true,
        nationalCourierEnabled: true,
        rajaOngkirOriginId: true,
      },
    });

    if (!tenant || getTenantAccessState(tenant) !== "ACTIVE") {
      return NextResponse.json({ error: "Toko tidak ditemukan" }, { status: 404 });
    }
    tenantId = tenant.id;

    // 2. Check if national courier is enabled.
    if (!tenant.nationalCourierEnabled) {
      return NextResponse.json(
        { results: [], integrationDisabled: true, error: "Kurir nasional tidak diaktifkan" },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    // 3. Check if platform RajaOngkir integration is active.
    try {
      await getRajaOngkirClientConfig();
    } catch (error) {
      if (error instanceof ShippingProviderError) {
        return NextResponse.json(
          { results: [], integrationDisabled: true, error: "Integrasi RajaOngkir belum aktif" },
          { status: 200, headers: { "Cache-Control": "no-store" } },
        );
      }
      throw error;
    }

    // 4. Check if tenant has origin configured.
    if (!tenant.rajaOngkirOriginId) {
      return NextResponse.json(
        { results: [], integrationDisabled: true, error: "Asal pengiriman belum dikonfigurasi" },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    // 5. Public rate limiting (layered: identity + tenant).
    try {
      await enforceRateLimit({
        scope: "storefront-shipping-destination-search",
        identifiers: layeredIdentifiers(identity, [
          digestIdentifier("tenant", tenant.id),
        ]),
        limit: 60,
        windowSeconds: 5 * 60,
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

    // 6. Parse request body.
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

    // 7. Search destinations via RajaOngkir, then mint tenant-bound tokens.
    const config = await getRajaOngkirClientConfig();
    const destinations = await searchDomesticDestination(query, config, { limit: 20 });

    const results = destinations.map((d) => ({
      ...d,
      token: createOriginSelectionToken({ ...destinationToPayload(d), tenantId: tenant.id }),
    }));

    return NextResponse.json(
      { results },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
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
    logServerError("storefront.shipping.destination-search", error, { requestId, tenantId });
    return internalErrorResponse(requestId);
  }
}