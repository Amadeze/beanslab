export type VerifiedGoogleUser = {
  sub: string;
  name: string;
  email: string;
};

export function parseVerifiedGoogleUser(value: unknown): VerifiedGoogleUser | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.sub !== "string"
    || candidate.sub.trim().length === 0
    || typeof candidate.name !== "string"
    || candidate.name.trim().length === 0
    || typeof candidate.email !== "string"
    || candidate.email.trim().length === 0
    || candidate.email_verified !== true
  ) {
    return null;
  }

  return {
    sub: candidate.sub.trim(),
    name: candidate.name.trim(),
    email: candidate.email.trim().toLowerCase(),
  };
}

export function googleLoginDestination(requestedPath: string): string {
  return requestedPath.startsWith("/") && !requestedPath.startsWith("//")
    ? requestedPath
    : "/dashboard";
}

export type GoogleSignInAccount = {
  id: string;
  googleId: string | null;
  password: string | null;
};

export type GoogleSignInDecision =
  | { action: "login"; user: GoogleSignInAccount }
  | { action: "link"; user: GoogleSignInAccount }
  | { action: "signup" }
  | { action: "reject"; error: "GoogleAccountConflict" | "EmailRegisteredUsePassword" };

/**
 * Decide how a verified Google identity maps onto an existing account.
 *
 * A Google identity may only be linked to an account that already owns that
 * Google id. It must never be silently linked to a *password-protected*
 * account sharing the email — that would let any Google visitor take over
 * someone else's workspace. Passwordless accounts are safe to link because
 * only the email owner could have created them via Google in the first place.
 */
export function resolveGoogleSignInTarget(
  userByGoogleId: GoogleSignInAccount | null,
  userByEmail: GoogleSignInAccount | null,
): GoogleSignInDecision {
  if (userByGoogleId && userByEmail && userByGoogleId.id !== userByEmail.id) {
    return { action: "reject", error: "GoogleAccountConflict" };
  }

  if (userByGoogleId) return { action: "login", user: userByGoogleId };

  if (userByEmail) {
    if (userByEmail.password) {
      return { action: "reject", error: "EmailRegisteredUsePassword" };
    }
    return { action: "link", user: userByEmail };
  }

  return { action: "signup" };
}
