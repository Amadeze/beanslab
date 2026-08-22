import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  canOptimizeStorefrontImage,
  StorefrontImage,
  StorefrontImageProvider,
} from "./StorefrontImage";

describe("StorefrontImage", () => {
  it("optimizes first-party, Supabase, and supported legacy image URLs", () => {
    expect(canOptimizeStorefrontImage("/uploads/tenant/photo.webp")).toBe(true);
    expect(canOptimizeStorefrontImage("https://tenant.supabase.co/storage/v1/object/public/ros-assets/photo.webp")).toBe(true);
    expect(canOptimizeStorefrontImage("https://images.unsplash.com/photo-1")).toBe(true);
    expect(canOptimizeStorefrontImage("https://merchant.example/photo.webp")).toBe(false);
    expect(canOptimizeStorefrontImage("javascript:alert(1)")).toBe(false);
  });

  it("turns the SEO image controls into real loading behavior", () => {
    const lazyHtml = renderToStaticMarkup(
      createElement(
        StorefrontImageProvider,
        { settings: { lazyLoadImages: true, preloadCritical: false } },
        createElement(StorefrontImage, {
          src: "https://merchant.example/photo.webp",
          alt: "Kopi Papua",
          width: 800,
          height: 800,
          sizes: "100vw",
        }),
      ),
    );
    expect(lazyHtml).toContain('loading="lazy"');
    expect(lazyHtml).toContain('decoding="async"');
    expect(lazyHtml).toContain('width="800"');
    expect(lazyHtml).toContain('height="800"');

    const criticalHtml = renderToStaticMarkup(
      createElement(
        StorefrontImageProvider,
        { settings: { lazyLoadImages: true, preloadCritical: true } },
        createElement(StorefrontImage, {
          src: "https://merchant.example/hero.webp",
          alt: "",
          width: 1600,
          height: 900,
          sizes: "100vw",
          critical: true,
        }),
      ),
    );
    expect(criticalHtml).toContain('loading="eager"');
    expect(criticalHtml).toContain('fetchPriority="high"');
  });
});
