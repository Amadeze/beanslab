import { NextResponse } from "next/server";
import { getValidatedCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptCredential } from "@/lib/credentials";
import { getRequestId, logServerError } from "@/lib/api-observability";

export async function POST(req: Request) {
  const requestId = getRequestId(req.headers);
  try {
    const user = await getValidatedCurrentUser();
    if (!user || user.role !== "OWNER") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as {
      serverKey?: string;
      isProduction?: boolean;
    };
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { midtransServerKey: true, midtransIsProduction: true },
    });
    const serverKey =
      body.serverKey || decryptCredential(tenant?.midtransServerKey);
    const isProduction =
      body.isProduction ?? tenant?.midtransIsProduction ?? false;

    if (!serverKey || typeof serverKey !== "string") {
      return NextResponse.json({ success: false, message: "Server Key is required." });
    }

    // Basic validation for Midtrans keys
    // Sandbox keys usually start with 'SB-Mid-server-'
    // Production keys usually start with 'Mid-server-'
    const isSandboxKey = serverKey.startsWith("SB-Mid-server-");
    const isProdKey = serverKey.startsWith("Mid-server-");

    if (isProduction && !isProdKey) {
      return NextResponse.json({ 
        success: false, 
        message: "Warning: You are in Production mode but the key doesn't look like a Production Server Key." 
      });
    }

    if (!isProduction && !isSandboxKey) {
      return NextResponse.json({ 
        success: false, 
        message: "Warning: You are in Sandbox mode but the key doesn't look like a Sandbox Server Key (SB-Mid-server-)." 
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Credential format matches the selected Midtrans environment."
    });

  } catch (error) {
    logServerError("settings.test-midtrans", error, { requestId });
    return NextResponse.json(
      {
        success: false,
        message: "Pengujian koneksi gagal.",
        requestId,
      },
      { status: 500, headers: { "X-Request-Id": requestId } },
    );
  }
}
