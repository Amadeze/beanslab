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
import { calculateDomesticCost } from "@/lib/shipping/providers/rajaongkir";
import { ShippingProviderError } from "@/lib/shipping/errors";
import { verifyOriginSelectionToken, destinationToPayload } from "@/lib/shipping/origin-token";
import { calculateShipmentWeightForTenant } from "@/lib/shipping/weight";
import { createCartFingerprint } from "@/lib/shipping/fingerprint";
import { createShippingQuoteToken } from "@/lib/shipping/quote-token";
import { RAJAONGKIR_TARE_MAX_GRAMS } from "@/lib/shipping/types";
import { verifyB2bAccessToken } from "@/lib/b2b-access";
import { loadStorefrontB2bContext, resolveB2bCatalogPrice } from "@/lib/storefront-b2b";

export const dynamic = "force-dynamic";

type QuoteItemInput = {
  productId?: string | null;
  offeringId?: string | null;
  variantId?: string | null;
  quantity?: number;
};

function toQuoteError(requestId: string, error: unknown, tenantId?: string) {
  if (error instanceof ShippingProviderError) {
    return NextResponse.json({ error: "Layanan ongkir tidak tersedia" }, { status: 503 });
  }
  logServerError("storefront.shipping.quote", error, { requestId, tenantId });
  return internalErrorResponse(requestId);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  const requestId = getRequestId(req.headers);
  const { subdomain } = await params;

  try {
    // 1. Resolve tenant from subdomain (tenant is NEVER taken from the body).
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
        rajaOngkirCourierCodes: true,
        rajaOngkirTareGrams: true,
        rajaOngkirOriginLabel: true,
        rajaOngkirOriginProvince: true,
        rajaOngkirOriginCity: true,
        rajaOngkirOriginDistrict: true,
        rajaOngkirOriginSubdistrict: true,
        rajaOngkirOriginPostalCode: true,
      },
    });

    if (!tenant || getTenantAccessState(tenant) !== "ACTIVE") {
      return NextResponse.json({ error: "Toko tidak ditemukan" }, { status: 404 });
    }

    if (!tenant.nationalCourierEnabled) {
      return NextResponse.json(
        { error: "Kurir nasional tidak diaktifkan" },
        { status: 400 },
      );
    }

    // Platform RajaOngkir integration must be active (throws INTEGRATION_DISABLED).
    let config;
    try {
      config = await getRajaOngkirClientConfig();
    } catch (error) {
      if (error instanceof ShippingProviderError) {
        return NextResponse.json(
          { error: "Integrasi RajaOngkir belum aktif" },
          { status: 400 },
        );
      }
      throw error;
    }

    if (!tenant.rajaOngkirOriginId) {
      return NextResponse.json(
        { error: "Asal pengiriman belum dikonfigurasi" },
        { status: 400 },
      );
    }

    const allowedCouriers = (Array.isArray(tenant.rajaOngkirCourierCodes)
      ? tenant.rajaOngkirCourierCodes.filter((code): code is string => typeof code === "string")
      : [])
      .map((code: string) => code.trim())
      .filter((code: string) => code.length > 0);
    if (allowedCouriers.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada kurir yang diizinkan" },
        { status: 400 },
      );
    }

    // 2. Public rate limiting (layered: identity + tenant).
    const identity = resolveClientIdentity(req.headers);
    try {
      await enforceRateLimit({
        scope: "storefront-shipping-quote",
        identifiers: layeredIdentifiers(identity, [
          digestIdentifier("tenant", tenant.id),
        ]),
        limit: 30,
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

    // 3. Parse and validate the request body.
    let body: { destinationToken?: unknown; items?: unknown; b2bAccessToken?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const destinationToken = body.destinationToken;
    if (typeof destinationToken !== "string" || destinationToken.length === 0) {
      return NextResponse.json({ error: "Token tujuan diperlukan" }, { status: 400 });
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "Item keranjang diperlukan" }, { status: 400 });
    }
    if (body.items.length > 50) {
      return NextResponse.json({ error: "Terlalu banyak item" }, { status: 400 });
    }

    let b2bContext = null;
    if (body.b2bAccessToken !== undefined) {
      if (typeof body.b2bAccessToken !== "string") {
        return NextResponse.json({ error: "Akses partner tidak valid." }, { status: 403 });
      }
      const access = verifyB2bAccessToken(body.b2bAccessToken);
      if (!access) return NextResponse.json({ error: "Akses partner tidak valid atau kedaluwarsa." }, { status: 403 });
      b2bContext = await loadStorefrontB2bContext(prisma, tenant.id, access, new Date(), { includeRecentOrders: false });
      if (!b2bContext) return NextResponse.json({ error: "Kontrak partner tidak lagi aktif." }, { status: 403 });
    }

    const items: QuoteItemInput[] = body.items.map((raw) => {
      const item = (raw ?? {}) as Record<string, unknown>;
      return {
        productId: typeof item.productId === "string" ? item.productId : null,
        offeringId: typeof item.offeringId === "string" ? item.offeringId : null,
        variantId: typeof item.variantId === "string" ? item.variantId : null,
        quantity: typeof item.quantity === "number" ? item.quantity : NaN,
      };
    });

    for (const item of items) {
      if (!Number.isInteger(item.quantity) || (item.quantity ?? 0) <= 0 || (item.quantity ?? 0) > 10_000) {
        return NextResponse.json({ error: "Kuantitas item tidak valid" }, { status: 400 });
      }
      const hasVariant = Boolean(item.variantId);
      const hasProduct = Boolean(item.productId);
      if (hasVariant === hasProduct) {
        return NextResponse.json(
          { error: "Item harus memiliki productId (produk) atau variantId (penawaran)" },
          { status: 400 },
        );
      }
    }

    // 4. Verify the tenant-bound destination token.
    const destination = verifyOriginSelectionToken(destinationToken);
    if (!destination) {
      return NextResponse.json(
        { error: "Token tujuan tidak valid atau kadaluwarsa" },
        { status: 400 },
      );
    }
    if (destination.tenantId !== tenant.id) {
      return NextResponse.json(
        { error: "Token tujuan tidak valid untuk toko ini" },
        { status: 400 },
      );
    }

    // 5. Canonical DB cart lookup (tenant-scoped, active, sellable rows only).
    const productIds = new Set<string>();
    const variantIds = new Set<string>();
    for (const item of items) {
      if (item.variantId) variantIds.add(item.variantId);
      else if (item.productId) productIds.add(item.productId);
    }

    const [products, variants] = await Promise.all([
      prisma.product.findMany({
        where: {
          id: { in: Array.from(productIds) },
          tenantId: tenant.id,
          type: "FINISHED_GOODS",
          isActive: true,
          ...(!b2bContext ? { price: { gt: 0 } } : {}),
        },
        select: { id: true, netWeightGrams: true, price: true, priceSilver: true, priceGold: true },
      }),
      prisma.offeringVariant.findMany({
        where: {
          id: { in: Array.from(variantIds) },
          tenantId: tenant.id,
          isActive: true,
          unitPrice: { gt: 0 },
        },
        select: { id: true, netWeightGrams: true, unitPrice: true },
      }),
    ]);

    const productMap = new Map(products.map((p) => [p.id, p]));
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    for (const item of items) {
      if (item.variantId && !variantMap.has(item.variantId)) {
        return NextResponse.json({ error: "Ada item keranjang yang tidak valid" }, { status: 400 });
      }
      if (!item.variantId && item.productId && !productMap.has(item.productId)) {
        return NextResponse.json({ error: "Ada item keranjang yang tidak valid" }, { status: 400 });
      }
      if (!item.variantId && item.productId && b2bContext) {
        const product = productMap.get(item.productId)!;
        const price = resolveB2bCatalogPrice({
          price: Number(product.price ?? 0),
          priceSilver: Number(product.priceSilver ?? 0),
          priceGold: Number(product.priceGold ?? 0),
        }, b2bContext.customer.tier, item.quantity!, b2bContext.priceBreaksByProduct.get(item.productId));
        if (price.unitPrice <= 0) {
          return NextResponse.json({ error: "Harga partner untuk salah satu item belum tersedia" }, { status: 400 });
        }
      }
    }

    // 6. Canonical shipment weight (server-authoritative; never client weight).
    const weightLines = items.map((item) =>
      item.variantId
        ? { productId: item.productId ?? "", offeringVariantId: item.variantId, quantity: item.quantity! }
        : { productId: item.productId!, offeringVariantId: null, quantity: item.quantity! }
    );

    let weightResult;
    try {
      weightResult = await calculateShipmentWeightForTenant(tenant.id, weightLines);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Berat kirim tidak valid" },
        { status: 400 },
      );
    }

    const tareGrams = tenant.rajaOngkirTareGrams ?? 0;
    if (!Number.isInteger(tareGrams) || tareGrams < 0 || tareGrams > RAJAONGKIR_TARE_MAX_GRAMS) {
      return NextResponse.json({ error: "Konfigurasi berat kirim tidak valid" }, { status: 400 });
    }
    const shipmentWeightGrams = Math.round(weightResult.shipmentWeightGrams);
    if (shipmentWeightGrams <= 0) {
      return NextResponse.json({ error: "Berat kirim tidak valid" }, { status: 400 });
    }

    // 7. Cart fingerprint binds tenant, origin/destination, tare, and every
    // canonical line (identity, quantity, net weight, unit price).
    const originProviderId = tenant.rajaOngkirOriginId;
    const destinationProviderId = destination.providerId;
    const fingerprintLines = items.map((item, idx) => {
      const lineWeight = weightResult.lineWeights[idx];
      return {
        productId: item.variantId ? "" : item.productId!,
        offeringVariantId: item.variantId ?? null,
        quantity: item.quantity!,
        netWeightGrams: lineWeight.netWeightGrams,
        unitPrice: item.variantId
          ? Number(variantMap.get(item.variantId)!.unitPrice)
          : Number(productMap.get(item.productId!)!.price ?? 0),
      };
    });

    const cartFingerprint = createCartFingerprint({
      tenantId: tenant.id,
      originProviderId,
      destinationProviderId,
      tareGrams,
      lines: fingerprintLines,
    });

    // 8. External RajaOngkir HTTP happens here, BEFORE any durable transaction.
    const ratePromises = allowedCouriers.map(async (courierCode) => {
      try {
        const rates = await calculateDomesticCost(
          {
            origin: originProviderId,
            destination: destinationProviderId,
            weight: shipmentWeightGrams,
            courier: courierCode,
          },
          config,
        );
        // Reject zero/negative rates; courier whitelist enforced per courier.
        return rates.filter((rate) => rate.cost > 0);
      } catch (error) {
        if (error instanceof ShippingProviderError) return [];
        throw error;
      }
    });

    const allRates = (await Promise.all(ratePromises)).flat();
    const validRates = allRates.filter(
      (rate) => allowedCouriers.includes(rate.courierCode) && Number.isFinite(rate.cost) && rate.cost > 0,
    );
    if (validRates.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada tarif tersedia" },
        { status: 400 },
      );
    }

    // 9. Origin snapshot from tenant settings (server-authoritative).
    const origin = destinationToPayload({
      providerId: originProviderId,
      label: tenant.rajaOngkirOriginLabel ?? "",
      province: tenant.rajaOngkirOriginProvince ?? undefined,
      city: tenant.rajaOngkirOriginCity ?? undefined,
      district: tenant.rajaOngkirOriginDistrict ?? undefined,
      subdistrict: tenant.rajaOngkirOriginSubdistrict ?? undefined,
      postalCode: tenant.rajaOngkirOriginPostalCode ?? undefined,
    });

    // 10. Issue short-TTL quote tokens per normalized option.
    const options = validRates.map((rate) => {
      const integerCost = Math.round(rate.cost);
      const token = createShippingQuoteToken({
        version: 1,
        tenantId: tenant.id,
        destination: {
          providerId: destination.providerId,
          label: destination.label,
          province: destination.province,
          city: destination.city,
          district: destination.district,
          subdistrict: destination.subdistrict,
          postalCode: destination.postalCode,
        },
        origin: {
          providerId: origin.providerId,
          label: origin.label,
          province: origin.province,
          city: origin.city,
          district: origin.district,
          subdistrict: origin.subdistrict,
          postalCode: origin.postalCode,
        },
        courierCode: rate.courierCode,
        courierName: rate.courierName,
        serviceCode: rate.serviceCode,
        serviceName: rate.serviceName,
        cost: integerCost,
        etd: rate.etd,
        shipmentWeightGrams,
        cartFingerprint,
        tareGrams,
      });
      return {
        courierCode: rate.courierCode,
        courierName: rate.courierName,
        serviceCode: rate.serviceCode,
        serviceName: rate.serviceName,
        cost: integerCost,
        etd: rate.etd,
        token,
      };
    });

    return NextResponse.json(
      { options },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return toQuoteError(requestId, error);
  }
}
