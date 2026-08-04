import { NextRequest, NextResponse } from "next/server";
import { getValidatedCurrentUser } from "@/lib/auth";
import { linkRoastToBatch } from "@/app/(dashboard)/roasting/actions";

export async function POST(req: NextRequest) {
  try {
    const user = await getValidatedCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    console.error("[POST /api/roasting/link-roast]", err);
    return NextResponse.json({ error: "Gagal menghubungkan roast." }, { status: 500 });
  }
}
