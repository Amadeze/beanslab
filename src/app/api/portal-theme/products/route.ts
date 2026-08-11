// =============================================================================
// PRODUCTS API — Canonical catalog payload for the tenant's customizer preview.
// Same shape as the live storefront (loadStorefrontCatalog): real products +
// coffee offerings with real-time kg availability.
// =============================================================================

import { NextResponse } from "next/server";
import { getValidatedCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadStorefrontCatalog } from "@/lib/storefront-catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getValidatedCurrentUser();
    if (!user) {
      return NextResponse.json({ products: [], offerings: [] });
    }

    const catalog = await loadStorefrontCatalog(prisma, user.tenantId);
    return NextResponse.json(catalog);
  } catch (err) {
    console.error("[products-api]", err);
    return NextResponse.json({ products: [], offerings: [] });
  }
}
