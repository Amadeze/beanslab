import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// React 19's dev RSC hydration tooling (react-server-dom) needs `unsafe-eval`
// in development. This is dev-only — production keeps a strict CSP without it.
const scriptSrcDev = isDev
  ? "'self' 'unsafe-inline' 'unsafe-eval' https://app.midtrans.com https://app.sandbox.midtrans.com"
  : "'self' 'unsafe-inline' https://app.midtrans.com https://app.sandbox.midtrans.com";

const cspHeader = [
  "default-src 'self'",
  `script-src ${scriptSrcDev}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https://*.supabase.co https://api.fonnte.com https://api.resend.com https://app.midtrans.com https://app.sandbox.midtrans.com",
  "frame-src 'self' https://app.midtrans.com https://app.sandbox.midtrans.com",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  output: "standalone",
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains"
          },
          {
            key: "Content-Security-Policy",
            value: cspHeader,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
