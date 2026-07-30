import crypto from "crypto";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { SESSION_OPTIONS } from "./session";

const CSRF_TOKEN_LENGTH = 32;
/**
 * Generate a CSRF token and store it in the session.
 * Returns the token to include in form data / headers.
 */
export async function generateCsrfToken(): Promise<string> {
  const token = crypto.randomBytes(CSRF_TOKEN_LENGTH).toString("base64url");
  const cookieStore = await cookies();
  const session = await getIronSession<{ csrfToken?: string }>(cookieStore, SESSION_OPTIONS);
  session.csrfToken = token;
  await session.save();
  return token;
}

/**
 * Validate a CSRF token against the one stored in the session.
 * Throws if invalid.
 */
export async function validateCsrfToken(token: string | null): Promise<void> {
  if (!token) {
    throw new Error("CSRF token is missing");
  }

  const cookieStore = await cookies();
  const session = await getIronSession<{ csrfToken?: string }>(cookieStore, SESSION_OPTIONS);

  if (!session.csrfToken || session.csrfToken !== token) {
    throw new Error("Invalid CSRF token");
  }
}

/**
 * Verify the request contains a valid CSRF token from either:
 * - x-csrf-token header
 * - _csrf token in form body
 */
export async function verifyCsrfFromRequest(req: Request): Promise<void> {
  const headerToken = req.headers.get("x-csrf-token");
  if (headerToken) {
    await validateCsrfToken(headerToken);
    return;
  }

  // For form submissions, try to extract from body
  // Note: This is a best-effort check; Next.js server actions handle CSRF via SameSite cookies
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const body = await req.text();
    const match = body.match(/_csrf=([^&]+)/);
    if (match) {
      await validateCsrfToken(decodeURIComponent(match[1]));
      return;
    }
  }

  throw new Error("CSRF token is missing");
}
