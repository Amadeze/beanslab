"use server";

import { getIronSession, type IronSession } from "iron-session";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { SESSION_OPTIONS, type SessionUser } from "@/lib/session";
import {
  enforceRateLimit,
  RateLimitError,
  requestIdentifier,
} from "@/lib/rate-limit";

type AppSession = IronSession<{ user?: SessionUser }>;

// ─── Login ───────────────────────────────────────────────────────────────────

export type LoginResult =
  | { success: true; role: string }
  | { success: false; error: string };

export async function loginAction(email: string, password: string): Promise<LoginResult> {
  try {
    const requestHeaders = await headers();
    await enforceRateLimit({
      scope: "login",
      identifier: `${requestIdentifier(requestHeaders)}:${email.toLowerCase().trim()}`,
      limit: 5,
      windowSeconds: 15 * 60,
    });

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        password: true,
        isActive: true,
        tenantId: true,
        tenant: { select: { isActive: true } },
      },
    });

    if (!user || !user.isActive || !user.tenant.isActive) {
      return { success: false, error: "Email atau password salah." };
    }

    // Compare password using bcrypt
    if (!user.password) {
      return { success: false, error: "Email atau password salah." };
    }
    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return { success: false, error: "Email atau password salah." };
    }

    const cookieStore = await cookies();
    const session = await getIronSession<{ user?: SessionUser }>(cookieStore, SESSION_OPTIONS);

    session.user = {
      id:    user.id,
      name:  user.name,
      email: user.email,
      role:  user.role as SessionUser["role"],
      tenantId: user.tenantId,
    };

    await session.save();

    return { success: true, role: user.role };
  } catch (err) {
    console.error("[loginAction]", err);
    if (err instanceof RateLimitError) {
      return { success: false, error: err.message };
    }
    return { success: false, error: "Terjadi kesalahan. Coba lagi." };
  }
}

// ─── Logout ──────────────────────────────────────────────────────────────────

export async function logoutAction() {
  const cookieStore = await cookies();
  const session = await getIronSession<{ user?: SessionUser }>(cookieStore, SESSION_OPTIONS);
  session.destroy();
  redirect("/login");
}

