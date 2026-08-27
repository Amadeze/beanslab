import { NextRequest, NextResponse } from "next/server";
import { requireApiUserWithActiveTenant, isNextRedirectError } from "@/lib/api-auth";
import { linkRoastToBatch } from "@/app/(dashboard)/roasting/actions";

export async function POST(req: NextRequest) {
  try {
    // Validasi sesi + tenant aktif di sini (JSON-friendly), sehingga action
    // di bawah tidak perlu redirect dari konteks API.
    const auth = await requireApiUserWithActiveTenant("OWNER", "MANAGER", "OPERATOR");
    if (!auth.ok) return auth.response;

    const body = await req.json();
    const { batchId, roastId } = body;

    if (!batchId || !roastId) {
      return NextResponse.json(
        { error: "batchId dan roastId wajib diisi." },
        { status: 400 },
      );
    }

    const result = await linkRoastToBatch(batchId, roastId);

    if (result.success) {
      return NextResponse.json({ success: true, batchCode: result.batchCode });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
  } catch (err) {
    if (isNextRedirectError(err)) {
      return NextResponse.json(
        { error: "Sesi tidak valid atau workspace tidak aktif." },
        { status: 401 },
      );
    }
    console.error("[POST /api/roasting/link-roast]", err);
    return NextResponse.json({ error: "Gagal menghubungkan roast." }, { status: 500 });
  }
}
