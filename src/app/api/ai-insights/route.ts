import { NextRequest, NextResponse } from "next/server";
import { queryReports } from "@/lib/ai-insights";
import { requireRole, requireTenantPrisma, getTenantTimezone } from "@/lib/auth";
import { isNextRedirectError } from "@/lib/api-auth";
import { getRequestId, logServerError } from "@/lib/api-observability";
import {
  layeredIdentifiers,
  resolveClientIdentity,
  tenantIdentifier,
  userIdentifier,
} from "@/lib/client-identity";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req.headers);

  try {
    const user = await requireRole("OWNER", "MANAGER");
    const identity = resolveClientIdentity(req.headers);
    await enforceRateLimit({
      scope: "ai-insights",
      identifiers: layeredIdentifiers(identity, [
        tenantIdentifier(user.tenantId),
        userIdentifier(user.id),
      ]),
      limit: 30,
      windowSeconds: 60,
    });
    const tenantPrisma = await requireTenantPrisma();
    const timezone = await getTenantTimezone();

    const body = await req.json();
    const query = body.query as string;

    if (!query || typeof query !== "string" || query.trim().length > 300) {
      return NextResponse.json(
        { error: "Pertanyaan wajib berupa teks dengan panjang maksimal 300 karakter." },
        { status: 400 },
      );
    }

    const result = await queryReports(query, tenantPrisma, timezone);

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

    if (isNextRedirectError(err)) {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
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
