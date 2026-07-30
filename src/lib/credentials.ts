import crypto from "crypto";

const PREFIX = "enc:v1";

function runtimeEncryptionSecret() {
  const secret = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "CREDENTIAL_ENCRYPTION_KEY is required for credentials.",
    );
  }
  return secret;
}

function encryptionKey(secret: string) {
  return crypto.createHash("sha256").update(secret).digest();
}

export function isEncryptedCredential(value: string) {
  return value.startsWith(`${PREFIX}:`);
}

export function encryptCredential(value: string) {
  return encryptCredentialWithSecret(value, runtimeEncryptionSecret());
}

export function encryptCredentialWithSecret(value: string, secret: string) {
  if (!value || isEncryptedCredential(value)) return value;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptCredential(value: string | null | undefined) {
  if (!value || !isEncryptedCredential(value)) return value ?? "";
  return decryptCredentialWithSecret(value, runtimeEncryptionSecret());
}

export function decryptCredentialWithSecret(
  value: string | null | undefined,
  secret: string,
) {
  if (!value || !isEncryptedCredential(value)) return value ?? "";

  const parts = value.split(":");
  if (parts.length !== 5) {
    throw new Error("Encrypted credential format is invalid.");
  }

  const [, , ivPart, tagPart, encryptedPart] = parts;
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(secret),
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
