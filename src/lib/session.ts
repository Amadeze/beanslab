import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { cache } from "react";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "MANAGER" | "OPERATOR" | "CASHIER" | "SUPERADMIN";
  tenantId: string;
  /** Epoch captured at login; must match User.sessionVersion on revalidation. */
  sessionVersion: number;
}

function getSessionPassword(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET must be configured in environment variables (minimum 32 characters).");
  }
  if (secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters long.");
  }
  return secret;
}

export const SESSION_OPTIONS = {
  get password() {
    return getSessionPassword();
  },
  cookieName: "ros_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    // OAuth callbacks are top-level cross-site navigations. `strict` can keep
    // the newly-created session cookie out of the callback redirect chain,
    // causing the dashboard proxy to send the user straight back to login.
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 8, // 8 jam
  },
};

export const getCurrentUser = cache(async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const session = await getIronSession<{ user?: SessionUser }>(cookieStore, SESSION_OPTIONS);
    return session.user ?? null;
  } catch (error) {
    // Session not found or invalid - return null for unauthenticated state
    return null;
  }
});
