import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_PORTAL_THEME_CONFIG } from "../defaults/default-config";
import { FaqSection } from "../components/sections/FaqSection";
import { HeaderNavSection } from "../components/sections/HeaderNavSection";
import { PortalThemeRenderer } from "../components/PortalThemeRenderer";

describe("Batch 7 storefront accessibility and performance behavior", () => {
  it("new storefront themes enable the three implemented SEO performance capabilities", () => {
    expect(DEFAULT_PORTAL_THEME_CONFIG.globalSettings.seo).toEqual({
      lazyLoadImages: true,
      preloadCritical: true,
      structuredData: true,
    });
  });

  it("renders FAQ controls with an explicit disclosure relationship", () => {
    const html = renderToStaticMarkup(createElement(FaqSection, {
      settings: { title: "Pertanyaan umum" },
      blocks: [
        {
          id: "shipping",
          type: "question",
          visible: true,
          settings: {
            question: "Kapan kopi dikirim?",
            answer: "Setelah roast selesai.",
          },
        },
      ],
    }));

    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="faq-answer-shipping"');
    expect(html).not.toContain("your-roastery");
  });

  it("gives the mobile navigation trigger a dialog relationship and accessible name", () => {
    const html = renderToStaticMarkup(createElement(HeaderNavSection, {
      settings: {
        styleMode: "glass_pill",
        logoText: "Kopi Arunika",
        navLinks: [],
      },
    }));

    expect(html).toContain('aria-label="Buka menu"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="portal-mobile-menu"');
  });

  it("honors both tenant and operating-system reduced-motion preferences", () => {
    const config = structuredClone(DEFAULT_PORTAL_THEME_CONFIG);
    config.globalSettings.animations.reduceMotion = true;
    const html = renderToStaticMarkup(createElement(PortalThemeRenderer, { config }));

    expect(html).toContain('data-motion-reduced="true"');
    expect(html).toContain("prefers-reduced-motion: reduce");
    expect(html).toContain("transition-duration: 0.01ms");
  });
});
