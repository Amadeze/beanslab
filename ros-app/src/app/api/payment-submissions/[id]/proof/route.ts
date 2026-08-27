import { NextResponse } from "next/server";
import { requireApiUserWithActiveTenant } from "@/lib/api-auth";
import { withTenant } from "@/lib/prisma";
import { readPrivateImage } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  // JSON-friendly auth: tanpa ini sesi kadaluarsa akan menjadi 307 redirect
  // dari sebuah API route (fetch klien tidak mengikuti redirect dengan aman).
  const auth = await requireApiUserWithActiveTenant("OWNER", "MANAGER", "CASHIER");
  if (!auth.ok) return auth.response;
  const tp = withTenant(auth.user.tenantId);
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
