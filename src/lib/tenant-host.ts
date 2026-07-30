const DEFAULT_ROOT_DOMAIN = "roastd.id";

export const RESERVED_TENANT_SUBDOMAINS = new Set([
  "www",
  "app",
  "admin",
  "api",
  "mail",
  "support",
  "studio",
  "status",
  "docs",
  "cdn",
]);

export function isReservedTenantSubdomain(value: string): boolean {
  return RESERVED_TENANT_SUBDOMAINS.has(value.toLowerCase());
}

export function tenantSubdomainFromHost(
  host: string | null,
  rootDomain = process.env.TENANT_ROOT_DOMAIN || DEFAULT_ROOT_DOMAIN,
): string | null {
  if (!host) return null;
  const hostname = host.split(":", 1)[0].toLowerCase().replace(/\.$/, "");
  let candidate: string | null = null;

  if (hostname.endsWith(".localhost")) {
    candidate = hostname.slice(0, -".localhost".length);
  } else {
    const suffix = `.${rootDomain.toLowerCase()}`;
    if (hostname.endsWith(suffix)) candidate = hostname.slice(0, -suffix.length);
  }

  if (
    !candidate ||
    candidate.includes(".") ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate) ||
    isReservedTenantSubdomain(candidate)
  ) {
    return null;
  }
  return candidate;
}

export function tenantStorefrontUrl(subdomain: string, currentOrigin?: string): string {
  const normalized = subdomain.toLowerCase().trim();
  if (currentOrigin) {
    const origin = new URL(currentOrigin);
    if (origin.hostname === "localhost" || origin.hostname === "127.0.0.1") {
      return `${origin.protocol}//${normalized}.localhost${origin.port ? `:${origin.port}` : ""}`;
    }
  }
  const rootDomain = process.env.NEXT_PUBLIC_TENANT_ROOT_DOMAIN || DEFAULT_ROOT_DOMAIN;
  return `https://${normalized}.${rootDomain}`;
}
