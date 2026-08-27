import { describe, expect, it } from "vitest";
import {
  buildStorefrontMetadata,
  buildStorefrontStructuredData,
  serializeStorefrontStructuredData,
} from "./storefront-seo";

const tenant = {
  name: "Kopi Arunika",
  subdomain: "arunika",
  logoUrl: "/uploads/arunika/logo.webp",
  heroImageUrl: "https://tenant.supabase.co/storage/v1/object/public/ros-assets/hero.webp",
  heroText: "Kopi spesialti dari pegunungan Indonesia.",
  aboutText: "Roastery independen di Jayapura.",
  catalogSubtitle: "Roast segar setiap pekan.",
  contactEmail: "halo@arunika.test",
  instagramHandle: "@kopiarunika",
};

describe("storefront SEO", () => {
  it("builds tenant-specific canonical, social, and descriptive metadata", () => {
    const metadata = buildStorefrontMetadata({
      tenant,
      canonicalUrl: "https://arunika.roastd.id",
      isPreview: false,
    });

    expect(metadata.title).toEqual({ absolute: "Kopi Arunika" });
    expect(metadata.description).toBe("Roastery independen di Jayapura.");
    expect(metadata.alternates?.canonical).toBe("https://arunika.roastd.id");
    expect(metadata.openGraph).toMatchObject({
      title: "Kopi Arunika",
      locale: "id_ID",
      siteName: "Kopi Arunika",
    });
    expect((metadata.twitter as { card?: string })?.card).toBe("summary_large_image");
    expect(JSON.stringify(metadata)).not.toContain("your-roastery");
    expect(JSON.stringify(metadata)).not.toContain("ROASTD.ID");
  });

  it("marks preview metadata noindex without changing the public canonical URL", () => {
    const metadata = buildStorefrontMetadata({
      tenant,
      canonicalUrl: "https://arunika.roastd.id",
      isPreview: true,
    });

    expect(metadata.robots).toMatchObject({ index: false, follow: false, noarchive: true });
    expect(metadata.alternates?.canonical).toBe("https://arunika.roastd.id");
  });

  it("emits only real catalog entries and valid positive IDR offers", () => {
    const data = buildStorefrontStructuredData({
      tenant,
      canonicalUrl: "https://arunika.roastd.id",
      products: [
        {
          id: "p1",
          code: "FG-001",
          name: "Papua Wamena",
          type: "FINISHED_GOODS",
          category: "Kopi",
          origin: "Wamena",
          roastLevel: "MEDIUM",
          description: "Cokelat dan jeruk.",
          imageUrl: "/uploads/arunika/p1.webp",
          price: 95000,
          priceSilver: null,
          priceGold: null,
          stockKg: null,
          stockUnit: 4,
          recipes: [],
          latestRoastDate: null,
        },
        {
          id: "p-zero",
          code: "FG-000",
          name: "Produk tanpa harga",
          type: "FINISHED_GOODS",
          category: null,
          origin: null,
          roastLevel: null,
          description: null,
          imageUrl: null,
          price: 0,
          priceSilver: null,
          priceGold: null,
          stockKg: null,
          stockUnit: null,
          recipes: [],
          latestRoastDate: null,
        },
      ],
      offerings: [],
    });
    const serialized = JSON.stringify(data);

    expect(serialized).toContain("Papua Wamena");
    expect(serialized).toContain('"priceCurrency":"IDR"');
    expect(serialized).toContain("https://schema.org/InStock");
    expect(serialized).not.toContain("Produk tanpa harga");
    expect(serialized).not.toContain("Unsplash");
  });

  it("escapes less-than characters before JSON-LD reaches a script tag", () => {
    const payload = serializeStorefrontStructuredData({
      name: "</script><script>alert(1)</script>",
    });
    expect(payload).not.toContain("<script");
    expect(payload).toContain("\\u003c/script>");
  });
});
