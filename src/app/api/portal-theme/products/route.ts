// =============================================================================
// PRODUCTS API — Returns real products for the tenant's catalog preview
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ products: [] });
    }

    const products = await prisma.product.findMany({
      where: {
        tenantId: user.tenantId,
        type: "FINISHED_GOODS",
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        origin: true,
        roastLevel: true,
        description: true,
        imageUrl: true,
        price: true,
        priceSilver: true,
        priceGold: true,
        stockUnit: true,
      },
      orderBy: [{ stockUnit: "desc" }, { name: "asc" }],
      take: 50,
    });

    return NextResponse.json({
      products: products.map((p) => ({
        ...p,
        price: p.price ? Number(p.price) : null,
        priceSilver: p.priceSilver ? Number(p.priceSilver) : null,
        priceGold: p.priceGold ? Number(p.priceGold) : null,
      })),
    });
  } catch (err) {
    console.error("[products-api]", err);
    return NextResponse.json({ products: [] });
  }
}
