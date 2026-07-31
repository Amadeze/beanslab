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
