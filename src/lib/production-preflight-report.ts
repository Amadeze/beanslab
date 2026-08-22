export type PrivateStorageCheck = "not_configured" | "reachable_private" | "failed";

export function buildUnavailablePreflightReport({
  env,
  missingEnvironment,
  invalidEnvironment,
  warnings,
  privateStorageCheck,
}: {
  env: Record<string, string | undefined>;
  missingEnvironment: readonly string[];
  invalidEnvironment: readonly string[];
  warnings: readonly string[];
  privateStorageCheck: PrivateStorageCheck;
}) {
  return {
    ready: false,
    database: "unreachable" as const,
    databaseError: "Database connection or readiness query failed.",
    missingEnvironment,
    invalidEnvironment,
    integrations: {
      email: Boolean(env.RESEND_API_KEY),
      subscriptionMidtrans: Boolean(env.MIDTRANS_SERVER_KEY),
      whatsapp: Boolean(env.WA_API_KEY),
      xenditPlatform: env.XENDIT_ENABLED === "true" && Boolean(
        env.XENDIT_SECRET_KEY && env.XENDIT_WEBHOOK_TOKEN,
      ),
      objectStorage: Boolean(
        env.SUPABASE_URL &&
        env.SUPABASE_SERVICE_ROLE_KEY &&
        env.SUPABASE_STORAGE_BUCKET &&
        env.SUPABASE_PRIVATE_STORAGE_BUCKET
      ),
      privateStorageCheck,
    },
    warnings,
  };
}
