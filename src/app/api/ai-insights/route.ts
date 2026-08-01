import { NextRequest, NextResponse } from "next/server";
import { queryReports } from "@/lib/ai-insights";
import { requireRole, requireTenantPrisma } from "@/lib/auth";
import { getRequestId, logServerError } from "@/lib/api-observability";
import { enforceRateLimit, RateLimitError, requestIdentifier } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req.headers);

  try {
    const user = await requireRole("OWNER", "MANAGER");
    await enforceRateLimit({
      scope: "ai-insights",
      identifier: `${user.tenantId}:${user.id}:${requestIdentifier(req.headers)}`,
      limit: 30,
      windowSeconds: 60,
    });
    const tenantPrisma = await requireTenantPrisma();

    const body = await req.json();
    const query = body.query as string;

    if (!query || typeof query !== "string" || query.trim().length > 300) {
      return NextResponse.json(
        { error: "Pertanyaan wajib berupa teks dengan panjang maksimal 300 karakter." },
        { status: 400 },
      );
    }

    const result = await queryReports(query, tenantPrisma);

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
      },
    });
  } catch (err: unknown) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: err.message },
        { status: 429, headers: { "Retry-After": String(err.retryAfter) } },
      );
    }

    logServerError("ai-insights", err, { requestId });

    if (err instanceof Error && err.message === "FORBIDDEN") {
      return NextResponse.json(
        { error: "Akses ditolak. Hanya OWNER dan MANAGER yang dapat menggunakan fitur ini." },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { error: "Terjadi kesalahan sistem. Silakan coba lagi." },
      { status: 500 },
    );
  }
}
