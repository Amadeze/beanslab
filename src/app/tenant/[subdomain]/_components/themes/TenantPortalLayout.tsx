"use client";

import React from "react";
import { ThemeProps } from "./ThemeProps";
import { ThemeSkin } from "./ThemeSkin";
import { HeaderSection } from "../sections/HeaderSection";
import { HeroSection } from "../sections/HeroSection";
import { ProblemSolutionSection } from "../sections/ProblemSolutionSection";
import { FeaturesSection } from "../sections/FeaturesSection";
import { UspSection } from "../sections/UspSection";
import { CatalogSection } from "../sections/CatalogSection";
import { TestimonialsSection } from "../sections/TestimonialsSection";
import { FaqSection } from "../sections/FaqSection";
import { FooterSection } from "../sections/FooterSection";

// =============================================================================
// TENANT PORTAL LAYOUT — Thin Orchestrator
// =============================================================================
// Delegates each section to dedicated components.
// Theme-specific styling is provided via the ThemeSkin object.
// =============================================================================

interface TenantPortalLayoutProps extends ThemeProps {
  skin: ThemeSkin;
}

export function TenantPortalLayout(props: TenantPortalLayoutProps) {
  const {
    tenant, cart, setIsCartOpen, handleAddToCart,
    heroGreeting, aboutText: aText, catalogTitle, catalogSubtitle,
    footerText, waLink, emailLink, igLink,
    iconStroke = 2, skin, customerTier, mounted,
  } = props;

  // ── Content fallbacks ──────────────────────────────────────────────────
  const heroText = heroGreeting || tenant?.heroText || "Precision in Every Roast.";
  const aboutText = aText || tenant?.aboutText || "Crafting premium wholesale coffee solutions for cafes and businesses.";

  const problemStmt = tenant?.problemStatement ||
    "Inconsistent roast profiles, unpredictable green bean supply, and inaccurate pricing calculation are hurting your cafe's margins. In a busy shop, consistency is everything—yet standard wholesale suppliers often treat coffee as a mere commodity, leaving you with fluctuating quality.";

  const solutionStmt = tenant?.solutionStatement ||
    "We eliminate the variables. By combining micro-batch roasting profiling, automated telemetry tracking, and direct-trade sourcing, we deliver beans that extract beautifully, batch after batch. We stand by our consistency so you can focus on building a world-class customer experience.";

  const uspStmt = tenant?.uspText ||
    "We roast to order using state-of-the-art sensory logging and telemetry. Our partners gain access to a dedicated order portal, fixed wholesale price tiers (Silver & Gold), and transparent traceability data for every batch.";

  const defaultFeatures = [
    { title: "Roast Profile Consistency", desc: "Every batch is digitally profiled and replicated to ensure identical extraction properties.", iconName: "target" },
    { title: "Direct-Trade Traceability", desc: "Ethically sourced directly from partner estates with transparent pricing and origin metrics.", iconName: "leaf" },
    { title: "B2B Priority Fulfillment", desc: "Custom roasting schedules aligned to your cafe's weekly volume with quick local shipping.", iconName: "zap" },
  ];
  const features: { title: string; desc: string; iconName: string }[] =
    (tenant?.features && Array.isArray(tenant.features) && tenant.features.length > 0)
      ? (tenant.features as any) : defaultFeatures;

  const testimonials: { name: string; role: string; text: string; rating: number }[] =
    (tenant?.testimonials && Array.isArray(tenant.testimonials) && tenant.testimonials.length > 0)
      ? (tenant.testimonials as any) : [];
  const showTestimonials = testimonials.length > 0;

  const defaultFaqs = [
    { question: "Berapa Minimum Order Quantity (MOQ) B2B?", answer: "Untuk pengiriman gratis kurir toko dalam kota, minimal order adalah 5 Kg Roasted Beans. Di luar itu, pemesanan minimal 1 Kg tetap dilayani dengan ongkir reguler." },
    { question: "Bagaimana sistem harga grosir Silver & Gold?", answer: "Sistem menetapkan harga Silver untuk komitmen bulanan > 10 Kg, dan harga Gold untuk komitmen > 30 Kg. Tier diskon Anda akan terupdate otomatis di sistem portal ini." },
    { question: "Berapa lama proses sangrai dan kirim?", answer: "Kami menyangrai setiap hari Selasa dan Kamis. Pesanan yang masuk sebelum hari sangrai akan dikirim H+1 sangrai untuk proses degassing optimal." },
  ];
  const faqs: { question: string; answer: string }[] =
    (tenant?.faqs && Array.isArray(tenant.faqs) && tenant.faqs.length > 0)
      ? (tenant.faqs as any) : defaultFaqs;

  const title = catalogTitle || "Daftar Produk";
  const subtitle = catalogSubtitle || "Katalog Grosir B2B";
  const footer = footerText || tenant?.footerText || "Didukung oleh roastd.id — Roastery Operating System.";
  // Tenant media can replace the dependable code-native coffee visual.
  const bgImage = tenant?.backgroundImageUrl || "";
  const products = props.products || [];

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className={`w-full min-h-screen ${skin.containerClass}`}>
      {/* Decorative overlay (heritage texture, cyber scanlines) */}
      {skin.overlay}

      <HeaderSection tenant={tenant} cart={cart} setIsCartOpen={setIsCartOpen} skin={skin} showTestimonials={showTestimonials} mounted={mounted} />
      <HeroSection heroText={heroText} aboutText={aboutText} bgImage={bgImage} waLink={waLink} skin={skin} />
      <ProblemSolutionSection problemStmt={problemStmt} solutionStmt={solutionStmt} skin={skin} />
      <FeaturesSection features={features} iconStroke={iconStroke} skin={skin} />
      <UspSection uspStmt={uspStmt} skin={skin} />
      <CatalogSection
        products={products}
        catalogTitle={title}
        catalogSubtitle={subtitle}
        handleAddToCart={handleAddToCart}
        customerTier={customerTier}
        skin={skin}
      />
      {showTestimonials && <TestimonialsSection testimonials={testimonials} skin={skin} />}
      <FaqSection faqs={faqs} skin={skin} />
      <FooterSection tenant={tenant} footerText={footer} igLink={igLink} emailLink={emailLink} skin={skin} showTestimonials={showTestimonials} />
    </div>
  );
}
