import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUserWithActiveTenant } from "@/lib/api-auth";

// Enum-like query param divalidasi sebelum masuk ke Prisma — nilai liar akan
// membuat query melempar error dan route jadi 500.
const ALLOWED_BATCH_STATUSES = new Set([
  "DRAFT",
  "IN_PROGRESS",
  "COMPLETED",
  "VOID",
]);

export async function GET(req: NextRequest) {
  const auth = await requireApiUserWithActiveTenant();
  if (!auth.ok) return auth.response;
  const user = auth.user;

  try {
    const status = req.nextUrl.searchParams.get("status");

    const where: any = { tenantId: user.tenantId };
    if (status) {
      if (!ALLOWED_BATCH_STATUSES.has(status)) {
        return NextResponse.json({ error: "Status tidak valid." }, { status: 400 });
      }
      where.status = status;
    }

    const batches = await prisma.parentRoastingBatch.findMany({
      where,
      select: {
        id: true,
        code: true,
        status: true,
        machineId: true,
        inputProduct: { select: { name: true } },
        outputProduct: { select: { name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ batches });
  } catch (err) {
    console.error("[GET /api/roasting/batches]", err);
    return NextResponse.json({ error: "Gagal memuat batch." }, { status: 500 });
  }
}
