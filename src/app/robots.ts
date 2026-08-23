import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/register", "/login", "/forgot-password"],
        disallow: [
          "/api/",
          "/superadmin/",
          "/onboarding/",
          "/dashboard/",
          "/inventory/",
          "/roasting/",
          "/produksi/",
          "/penjualan/",
          "/kasir/",
          "/keuangan/",
          "/laporan/",
          "/settings/",
          "/billing/",
          "/katalog/",
          "/gudang/",
          "/cupping/",
          "/audit/",
          "/nota/",
          "/invoice/",
        ],
      },
    ],
    sitemap: "https://roastd.id/sitemap.xml",
  };
}
