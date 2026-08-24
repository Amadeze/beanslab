import type { PortalThemeConfig, PortalGlobalSettings } from "@/features/portal-theme/types";

export interface ReadinessCheck {
  id: string;
  label: string;
  description: string;
  passed: boolean;
  severity: "critical" | "warning" | "info";
  details?: string;
}

export interface ReadinessResult {
  score: number; // 0-100
  checks: ReadinessCheck[];
  canTransact: boolean; // critical checks all pass
  missingCritical: string[];
  missingWarning: string[];
}

const CRITICAL_CHECKS = [
  "logo",
  "payment_method",
  "product_count",
  "product_completeness",
] as const;

const WARNING_CHECKS = [
  "hero_image",
  "hero_text",
  "about_text",
  "contact_info",
  "catalog_title",
] as const;

const INFO_CHECKS = [
  "instagram",
  "shipping_configured",
] as const;

interface TenantDataForReadiness {
  name: string;
  portalThemeConfig: PortalThemeConfig | null;
  legacyFields: {
    logoUrl?: string | null;
    heroImageUrl?: string | null;
    heroText?: string | null;
    whatsappNumber?: string | null;
    contactEmail?: string | null;
    instagramHandle?: string | null;
    aboutText?: string | null;
    catalogTitle?: string | null;
    catalogSubtitle?: string | null;
  };
  paymentMethods: Array<{
    id: string;
    provider: string;
    method: string;
  }>;
  products: Array<{
    id: string;
    imageUrl: string | null;
    description: string | null;
    origin: string | null;
    roastLevel: string | null;
  }>;
  offerings: Array<{ id: string }>;
}

export function calculateStorefrontReadiness(data: TenantDataForReadiness): ReadinessResult {
  const checks: ReadinessCheck[] = [];

  // --- CRITICAL ---
  // 1. Logo
  const hasLogo = !!(
    data.portalThemeConfig?.globalSettings.brandKit?.logoLight ||
    data.portalThemeConfig?.globalSettings.brandKit?.logoDark ||
    data.legacyFields.logoUrl
  );
  checks.push({
    id: "logo",
    label: "Logo Brand",
    description: "Logo terpasang di brand kit atau legacy field",
    passed: hasLogo,
    severity: "critical",
    details: hasLogo ? undefined : "Upload logo di Pengaturan > Portal > Brand Kit",
  });

  // 2. Payment method
  const hasPayment = data.paymentMethods.length > 0;
  checks.push({
    id: "payment_method",
    label: "Metode Pembayaran",
    description: "Minimal satu metode pembayaran aktif",
    passed: hasPayment,
    severity: "critical",
    details: hasPayment ? undefined : "Tambahkan transfer bank, QRIS, atau COD di Pengaturan > Pembayaran",
  });

  // 3. Product count (>= 3)
  const productCount = data.products.length;
  const hasEnoughProducts = productCount >= 3;
  checks.push({
    id: "product_count",
    label: "Jumlah Produk",
    description: "Minimal 3 produk untuk katalog yang menarik",
    passed: hasEnoughProducts,
    severity: "critical",
    details: hasEnoughProducts ? undefined : `${productCount}/3 produk. Tambah produk di Master Data > Produk`,
  });

  // 4. Product completeness (image, description, origin, roastLevel)
  let completeProducts = 0;
  for (const p of data.products) {
    const hasImage = !!p.imageUrl;
    const hasDesc = !!p.description && p.description.length >= 50;
    const hasOrigin = !!p.origin;
    const hasRoast = !!p.roastLevel;
    if (hasImage && hasDesc && hasOrigin && hasRoast) {
      completeProducts++;
    }
  }
  const productCompleteness = data.products.length > 0 ? (completeProducts / data.products.length) * 100 : 0;
  const productsComplete = productCompleteness >= 80; // 80% produk lengkap
  checks.push({
    id: "product_completeness",
    label: "Kelengkapan Data Produk",
    description: "Produk memiliki foto, deskripsi ≥50 char, origin, roast level",
    passed: productsComplete,
    severity: "critical",
    details: productsComplete
      ? undefined
      : `${Math.round(productCompleteness)}% produk lengkap. Lengkapi foto, deskripsi, origin, roast level di Master Data > Produk`,
  });

  // --- WARNING ---
  // 5. Hero image
  const hasHeroImage = !!(
    data.portalThemeConfig?.sections.find((s) => s.type === "hero_banner")?.settings?.imageUrl ||
    data.legacyFields.heroImageUrl
  );
  checks.push({
    id: "hero_image",
    label: "Foto Hero",
    description: "Hero banner memiliki gambar latar",
    passed: !!hasHeroImage,
    severity: "warning",
    details: hasHeroImage ? undefined : "Tambah gambar hero di Pengaturan > Portal > Customizer > Beranda",
  });

  // 6. Hero text
  const hasHeroText = !!(
    data.portalThemeConfig?.sections.find((s) => s.type === "hero_banner")?.settings?.title ||
    data.legacyFields.heroText
  );
  checks.push({
    id: "hero_text",
    label: "Judul & Subtitle Hero",
    description: "Hero memiliki headline & subtitle yang menarik",
    passed: !!hasHeroText,
    severity: "warning",
    details: hasHeroText ? undefined : "Isi judul & subtitle hero di Customizer > Beranda",
  });

  // 7. About text
  const hasAbout = !!(
    data.portalThemeConfig?.sections.find((s) => s.type === "rich_text" || s.type === "image_with_text")?.enabled ||
    data.legacyFields.aboutText
  );
  checks.push({
    id: "about_text",
    label: "Cerita Roastery (About)",
    description: "Halaman memiliki bagian 'Tentang Kami' atau cerita brand",
    passed: hasAbout,
    severity: "warning",
    details: hasAbout ? undefined : "Tambah section Rich Text atau Image with Text di Customizer > Konten",
  });

  // 8. Contact info
  const hasContact = !!(
    data.legacyFields.whatsappNumber ||
    data.legacyFields.contactEmail ||
    data.legacyFields.instagramHandle
  );
  checks.push({
    id: "contact_info",
    label: "Info Kontak",
    description: "WhatsApp, email, atau Instagram tersedia",
    passed: hasContact,
    severity: "warning",
    details: hasContact ? undefined : "Isi WhatsApp, email, atau Instagram di Pengaturan > Portal > Dasar",
  });

  // 9. Catalog title
  const hasCatalogTitle = !!(
    data.portalThemeConfig?.sections.find((s) => s.type === "catalog_grid")?.settings?.title ||
    data.legacyFields.catalogTitle
  );
  checks.push({
    id: "catalog_title",
    label: "Judul Katalog",
    description: "Katalog produk memiliki judul & subtitle",
    passed: !!hasCatalogTitle,
    severity: "warning",
    details: hasCatalogTitle ? undefined : "Isi judul & subtitle katalog di Customizer > Katalog",
  });

  // --- INFO ---
  // 10. Instagram
  const hasInstagram = !!(
    data.portalThemeConfig?.globalSettings.brandKit?.instagramHandle ||
    data.legacyFields.instagramHandle
  );
  checks.push({
    id: "instagram",
    label: "Instagram Handle",
    description: "Link Instagram untuk social proof",
    passed: !!hasInstagram,
    severity: "info",
    details: hasInstagram ? undefined : "Tambahkan @handle Instagram di Brand Kit",
  });

  // 11. Shipping configured
  const hasShipping = true; // TODO: check storefrontPickupEnabled, storefrontDeliveryEnabled, etc.
  checks.push({
    id: "shipping_configured",
    label: "Konfigurasi Pengiriman",
    description: "Pickup, delivery, atau kurir sudah dikonfigurasi",
    passed: hasShipping,
    severity: "info",
    details: hasShipping ? undefined : "Konfigurasi di Pengaturan > Portal > Pengiriman",
  });

  // Calculate score
  const criticalPassed = checks.filter((c) => CRITICAL_CHECKS.includes(c.id as any) && c.passed).length;
  const criticalTotal = CRITICAL_CHECKS.length;
  const warningPassed = checks.filter((c) => WARNING_CHECKS.includes(c.id as any) && c.passed).length;
  const warningTotal = WARNING_CHECKS.length;
  const infoPassed = checks.filter((c) => INFO_CHECKS.includes(c.id as any) && c.passed).length;
  const infoTotal = INFO_CHECKS.length;

  // Weighted score: critical 60%, warning 30%, info 10%
  const criticalScore = criticalTotal > 0 ? (criticalPassed / criticalTotal) * 60 : 60;
  const warningScore = warningTotal > 0 ? (warningPassed / warningTotal) * 30 : 30;
  const infoScore = infoTotal > 0 ? (infoPassed / infoTotal) * 10 : 10;
  const score = Math.round(criticalScore + warningScore + infoScore);

  const missingCritical = checks
    .filter((c) => CRITICAL_CHECKS.includes(c.id as any) && !c.passed)
    .map((c) => c.label);
  const missingWarning = checks
    .filter((c) => WARNING_CHECKS.includes(c.id as any) && !c.passed)
    .map((c) => c.label);

  return {
    score,
    checks,
    canTransact: missingCritical.length === 0,
    missingCritical,
    missingWarning,
  };
}

export function getReadinessBadge(score: number): { label: string; color: string } {
  if (score >= 90) return { label: "Siap Jual", color: "green" };
  if (score >= 70) return { label: "Hampir Siap", color: "yellow" };
  if (score >= 50) return { label: "Perlu Perbaikan", color: "orange" };
  return { label: "Belum Siap", color: "red" };
}