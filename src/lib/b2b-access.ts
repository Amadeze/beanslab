import crypto from "crypto";

const PREFIX = "b2bv1";
const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60;

export type B2bAccessPayload = {
  tenantId: string;
  customerId: string;
  expiresAt: number;
};

function runtimeSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be configured to issue B2B access links.");
  }
  return secret;
}

function signature(payload: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(`${PREFIX}.${payload}`).digest("base64url");
}

function sameSignature(expected: string, received: string) {
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function issueB2bAccessTokenWithSecret(
  input: { tenantId: string; customerId: string; expiresAt?: Date },
  secret: string,
  now = new Date(),
) {
  const payload: B2bAccessPayload = {
    tenantId: input.tenantId,
    customerId: input.customerId,
    expiresAt: Math.floor((input.expiresAt?.getTime() ?? now.getTime() + DEFAULT_TTL_SECONDS * 1000) / 1000),
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${PREFIX}.${encoded}.${signature(encoded, secret)}`;
}

export function issueB2bAccessToken(
  input: { tenantId: string; customerId: string; expiresAt?: Date },
  now = new Date(),
) {
  return issueB2bAccessTokenWithSecret(input, runtimeSecret(), now);
}

export function verifyB2bAccessTokenWithSecret(
  token: string | null | undefined,
  secret: string,
  now = new Date(),
): B2bAccessPayload | null {
  if (!token) return null;
  const [prefix, encoded, receivedSignature, ...extra] = token.split(".");
  if (prefix !== PREFIX || !encoded || !receivedSignature || extra.length > 0) return null;
  if (!sameSignature(signature(encoded, secret), receivedSignature)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<B2bAccessPayload>;
    if (
      typeof payload.tenantId !== "string"
      || payload.tenantId.length === 0
      || typeof payload.customerId !== "string"
      || payload.customerId.length === 0
      || typeof payload.expiresAt !== "number"
      || !Number.isSafeInteger(payload.expiresAt)
      || payload.expiresAt <= Math.floor(now.getTime() / 1000)
    ) return null;
    return payload as B2bAccessPayload;
  } catch {
    return null;
  }
}

export function verifyB2bAccessToken(token: string | null | undefined, now = new Date()) {
  return verifyB2bAccessTokenWithSecret(token, runtimeSecret(), now);
}
