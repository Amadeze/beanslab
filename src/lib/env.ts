import { z } from "zod";

const serverSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid PostgreSQL connection string"),
  DIRECT_URL: z.string().url("DIRECT_URL must be a valid PostgreSQL connection string").optional(),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  CREDENTIAL_ENCRYPTION_KEY: z.string().min(16, "CREDENTIAL_ENCRYPTION_KEY must be at least 16 characters").optional(),
  APP_URL: z.string().url("APP_URL must be a valid URL").optional(),
  CRON_SECRET: z.string().min(8, "CRON_SECRET must be at least 8 characters").optional(),
  MIDTRANS_SERVER_KEY: z.string().min(1, "MIDTRANS_SERVER_KEY is required in production").optional(),
  NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: z.string().min(1).optional(),
  MIDTRANS_IS_PRODUCTION: z.enum(["true", "false"]).optional(),
  XENDIT_SECRET_KEY: z.string().min(1).optional(),
  XENDIT_WEBHOOK_TOKEN: z.string().min(1).optional(),
  XENDIT_ENABLED: z.enum(["true", "false"]).optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().optional(),
  WA_API_KEY: z.string().optional(),
  WA_API_URL: z.string().url().optional(),
  ARTISAN_CONNECTOR_TOKEN_PEPPER: z.string().min(1).optional(),
  ARTISAN_PAIRING_CODE_PEPPER: z.string().min(1).optional(),
  ARTISAN_MAX_UPLOAD_BYTES: z.string().optional(),
  ARTISAN_CONNECTOR_DOWNLOAD_URL: z.string().url().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

function validateServerEnv(): ServerEnv {
  const result = serverSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.format();
    const errors = Object.entries(formatted)
      .filter(([, v]) => v && typeof v === "object" && "_errors" in v && (v as any)._errors.length > 0)
      .map(([key, val]) => `  ${key}: ${(val as any)._errors.join(", ")}`)
      .join("\n");
    throw new Error("Environment validation failed:\n" + errors);
  }
  return result.data;
}

let _env: ServerEnv | null = null;

/**
 * Get validated server environment variables.
 * Throws on first call if validation fails (prevents app from running with missing secrets).
 * Safe to call multiple times (cached after first call).
 */
export function getEnv(): ServerEnv {
  if (_env === null) {
    _env = validateServerEnv();
  }
  return _env;
}

// Validate on import in server environments
if (typeof window === "undefined") {
  getEnv();
}
