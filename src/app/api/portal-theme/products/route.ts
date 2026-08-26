// =============================================================================
// PRODUCTS API — Canonical catalog payload for the tenant's customizer preview.
// Same shape as the live storefront (loadStorefrontCatalog): real products +
// coffee offerings with real-time kg availability.
// =============================================================================

import { NextResponse } from "next/server";
import { requireApiUserWithActiveTenant } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { loadStorefrontCatalog } from "@/lib/storefront-catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireApiUserWithActiveTenant();
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const catalog = await loadStorefrontCatalog(prisma, user.tenantId);
    return NextResponse.json(catalog);
  } catch (err) {
    console.error("[products-api]", err);
    return NextResponse.json({ products: [], offerings: [] });
  }
}
