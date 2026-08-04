import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getValidatedCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getValidatedCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const status = req.nextUrl.searchParams.get("status");

    const where: any = { tenantId: user.tenantId };
    if (status) {
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
