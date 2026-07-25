import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const logs = await (prisma as any).webhookLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error("Failed to fetch webhook logs:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
