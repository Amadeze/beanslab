export type PrivateStorageCheck = "not_configured" | "reachable_private" | "failed";

const EXAMPLE_SECRET_VALUES: Partial<Record<string, string>> = {
  SESSION_SECRET: "change-me-to-a-random-string-at-least-32-chars",
  CREDENTIAL_ENCRYPTION_KEY: "independent-random-secret-at-least-32-chars",
  CRON_SECRET: "independent-random-secret-at-least-32-chars",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
};

export function findPlaceholderProductionEnvironment(
  env: Record<string, string | undefined>,
): string[] {
  const invalid: string[] = [];

  for (const [name, exampleValue] of Object.entries(EXAMPLE_SECRET_VALUES)) {
    if (env[name] === exampleValue) {
      invalid.push(`${name} still uses the example value.`);
    }
  }

  for (const name of ["DATABASE_URL", "DIRECT_URL"] as const) {
    const value = env[name];
    if (!value) continue;
    try {
      const url = new URL(value);
      if (
        url.hostname === "host" ||
        url.username === "user" ||
        url.password === "PASSWORD" ||
        url.pathname === "/database"
      ) {
        invalid.push(`${name} still uses the example database connection.`);
      }
    } catch {
      invalid.push(`${name} is not a valid database URL.`);
    }
  }

  if (env.APP_URL) {
    try {
      if (new URL(env.APP_URL).hostname === "app.example.com") {
        invalid.push("APP_URL still uses the example hostname.");
      }
    } catch {
      invalid.push("APP_URL is not a valid URL.");
    }
  }

  if (env.SUPABASE_URL) {
    try {
      if (new URL(env.SUPABASE_URL).hostname === "project.supabase.co") {
        invalid.push("SUPABASE_URL still uses the example project hostname.");
      }
    } catch {
      invalid.push("SUPABASE_URL is not a valid URL.");
    }
  }

  return [...new Set(invalid)];
}

export function buildInvalidConfigurationPreflightReport({
  env,
  missingEnvironment,
  invalidEnvironment,
  warnings,
}: {
  env: Record<string, string | undefined>;
  missingEnvironment: readonly string[];
  invalidEnvironment: readonly string[];
  warnings: readonly string[];
}) {
  return {
    ready: false,
    database: "not_checked" as const,
    databaseError: "Database checks were skipped because production configuration is invalid.",
    missingEnvironment,
    invalidEnvironment,
    integrations: buildIntegrationSummary(env, "not_configured"),
    warnings,
  };
}

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
    integrations: buildIntegrationSummary(env, privateStorageCheck),
    warnings,
  };
}

function buildIntegrationSummary(
  env: Record<string, string | undefined>,
  privateStorageCheck: PrivateStorageCheck,
) {
  return {
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
  };
}
