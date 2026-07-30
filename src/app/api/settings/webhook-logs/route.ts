import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, requireTenantPrisma } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("OWNER", "MANAGER");
    const tenantPrisma = await requireTenantPrisma();

    const logs = await tenantPrisma.webhookEvent.findMany({
      orderBy: { receivedAt: "desc" },
      take: 50,
      select: {
        id: true,
        provider: true,
        eventType: true,
        status: true,
        error: true,
        receivedAt: true,
        processedAt: true,
      },
    });

    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error("Failed to fetch webhook logs:", error);
    return NextResponse.json({ error: error.message }, { status: error.message === "FORBIDDEN" ? 403 : 500 });
  }
}
