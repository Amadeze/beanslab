import { NextResponse } from "next/server";
import { getValidatedCurrentUser } from "@/lib/auth";
import type { SessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

/**
 * Deteksi error kontrol alur NEXT_REDIRECT dari next/navigation.
 * redirect() melempar objek dengan digest berawalan "NEXT_REDIRECT;..." —
 * di route handler API itu TIDAK boleh dibiarkan lolos (jadi 307) maupun
 * ditelan jadi 500; konversi menjadi respons JSON 401/403.
 */
export function isNextRedirectError(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

export type ApiAuthResult =
  | { ok: true; user: SessionUser }
  | { ok: false; response: NextResponse };

/**
 * Auth untuk API route tanpa redirect: memvalidasi sesi terhadap DB
 * (user aktif, sessionVersion terkini) DAN status tenant aktif.
 * Selalu mengembalikan JSON 401/403 — tidak pernah melempar NEXT_REDIRECT.
 */
export async function requireApiUserWithActiveTenant(
  ...allowedRoles: SessionUser["role"][]
): Promise<ApiAuthResult> {
  const user = await getValidatedCurrentUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Sesi tidak valid. Silakan masuk." } },
        { status: 401 },
      ),
    };
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Peran tidak diizinkan." } },
        { status: 403 },
      ),
    };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: user.tenantId },
    select: { isActive: true },
  });
  if (!tenant?.isActive) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "TENANT_INACTIVE", message: "Workspace tidak aktif." } },
        { status: 403 },
      ),
    };
  }

  return { ok: true, user };
}
