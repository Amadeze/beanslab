import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { isNextRedirectError } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireRole("SUPERADMIN");

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 200);
    const tenantId = searchParams.get("tenantId");
    const action = searchParams.get("action");

    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    if (action) where.action = action;

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        tenantId: true,
        userId: true,
        createdAt: true,
        metadata: true,
        user: {
          select: {
            name: true,
            email: true,
            role: true,
          },
        },
        tenant: {
          select: {
            code: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error("[superadmin/audit]", error);
    // Sesi tidak valid: requireRole melempar NEXT_REDIRECT — jangan biarkan
    // jadi 500; konversi ke 401 JSON.
    if (isNextRedirectError(error)) {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    const forbidden = error instanceof Error && error.message.startsWith("FORBIDDEN");
    return NextResponse.json(
      { error: forbidden ? "FORBIDDEN" : "Terjadi kesalahan sistem." },
      { status: forbidden ? 403 : 500 },
    );
  }
}
