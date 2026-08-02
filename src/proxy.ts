import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { tenantSubdomainFromHost } from "@/lib/tenant-host";

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/api/health",
  "/api/cron",
  "/api/webhooks",
  "/api/integrations",
  "/api/auth",
  "/api/billing/checkout",
  "/api/portal-theme",
  "/studio/authorize",
];

function isPublicRoute(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname.startsWith("/tenant/")) return true;
  if (pathname.startsWith("/api/tenant/")) return true;
  for (const route of PUBLIC_ROUTES) {
    if (pathname === route || pathname.startsWith(route + "/") || pathname.startsWith(route + "?")) {
      return true;
    }
  }
  return false;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const tenantSubdomain = tenantSubdomainFromHost(request.headers.get("host"));

  if (tenantSubdomain && (pathname === "/" || pathname.startsWith("/order/"))) {
    const storefrontUrl = request.nextUrl.clone();
    storefrontUrl.pathname = pathname === "/"
      ? `/tenant/${tenantSubdomain}`
      : `/tenant/${tenantSubdomain}${pathname}`;
    const response = NextResponse.rewrite(storefrontUrl);
    response.headers.set("x-roastd-tenant", tenantSubdomain);
    return response;
  }

  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get("ros_session");

  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images/|fonts/).*)",
  ],
};
