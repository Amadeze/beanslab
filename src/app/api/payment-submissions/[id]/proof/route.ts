import { NextResponse } from "next/server";
import { requireRole, requireTenantPrisma } from "@/lib/auth";
import { readPrivateImage } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireRole("OWNER", "MANAGER", "CASHIER");
  const tp = await requireTenantPrisma();
  const { id } = await params;
  const submission = await tp.paymentSubmission.findUnique({
    where: { id },
    select: { proofObjectPath: true, proofMimeType: true },
  });
  if (!submission?.proofObjectPath || !submission.proofMimeType) {
    return NextResponse.json({ error: "Bukti tidak ditemukan." }, { status: 404 });
  }
  const image = await readPrivateImage(submission.proofObjectPath, submission.proofMimeType);
  return new NextResponse(new Uint8Array(image.buffer), {
    headers: {
      "Content-Type": image.mimeType,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
