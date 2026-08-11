import { notFound } from "next/navigation";
import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { TenantPortalClient } from "./_components/TenantPortalClient";
import { getTenantAccessState } from "@/lib/subscription";
import { planHasFeature } from "@/lib/plans";
import { resolveTenantPortalTheme } from "@/features/portal-theme/resolver";
import { tenantStorefrontUrl } from "@/lib/tenant-host";

export const dynamic = "force-dynamic";

interface TenantPageProps {
  params: Promise<{
    subdomain: string;
  }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: TenantPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const subdomain = resolvedParams.subdomain;
  
  const tenant = await prisma.tenant.findUnique({
    where: { subdomain },
    select: { name: true, logoUrl: true }
  });

  if (!tenant) return {};

  return {
    title: tenant.name,
    alternates: { canonical: tenantStorefrontUrl(subdomain) },
    openGraph: { title: tenant.name, url: tenantStorefrontUrl(subdomain) },
    icons: {
      icon: tenant.logoUrl || '/favicon.ico',
    }
  };
}

export default async function TenantB2BPortal({ params, searchParams }: TenantPageProps) {
  const resolvedParams = await params;
  const subdomain = resolvedParams.subdomain;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const isPreviewMode = resolvedSearchParams?.preview === "1" || resolvedSearchParams?.preview === "true";
  
  const tenant = await prisma.tenant.findUnique({
    where: { subdomain },
    select: {
      id: true,
      name: true,
      subdomain: true,
      themeColor: true,
      logoUrl: true,
      heroImageUrl: true,
      heroText: true,
      backgroundImageUrl: true,
      whatsappNumber: true,
      contactEmail: true,
      instagramHandle: true,
      aboutText: true,
      catalogTitle: true,
      catalogSubtitle: true,
      footerText: true,
      problemStatement: true,
      solutionStatement: true,
      uspText: true,
      features: true,
      testimonials: true,
      faqs: true,
      layoutStyle: true,
      fontFamily: true,
      themeMode: true,
      borderRadius: true,
      animationStyle: true,
      animationDirection: true,
      iconStyle: true,
      themeConfig: true,
      isActive: true,
      subscriptionTier: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      nextBillingDate: true,
      storefrontPickupEnabled: true,
      storefrontDeliveryEnabled: true,
      storefrontFlatShippingRate: true,
      storefrontFreeShippingMinimum: true,
      storefrontTaxRate: true,
      products: {
        where: {
          type: "FINISHED_GOODS",
          isActive: true,
        },
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          category: true,
          origin: true,
          roastLevel: true,
          description: true,
          imageUrl: true,
          price: true,
          priceSilver: true,
          priceGold: true,
          stockKg: true,
          stockUnit: true,
          recipes: {
            where: { isActive: true },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { storefrontGrindOptions: true },
          },
        },
        orderBy: [
          { stockKg: "desc" },
          { name: "asc" },
        ],
      },
      offerings: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          imageUrl: true,
          roastLevel: true,
          grindOptions: true,
          allowCustomGrind: true,
          coffeeSource: { select: { name: true } },
          variants: {
            where: { isActive: true },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              packageName: true,
              netWeightGrams: true,
              unitPrice: true,
            },
          },
        },
      },
      tenantPaymentMethods: {
        where: { isActive: true },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          provider: true,
          method: true,
          label: true,
          bankName: true,
          accountNumber: true,
          accountHolder: true,
          qrisImageUrl: true,
          instructions: true,
          requireProof: true,
        },
      },
    }
  });

  if (
    !tenant ||
    getTenantAccessState(tenant) !== "ACTIVE" ||
    !planHasFeature(tenant.subscriptionTier, "STOREFRONT")
  ) {
    notFound();
  }

  // Next.js App Router Server -> Client serialization doesn't support Prisma Decimal
  // Only storefront fields are serialized; internal costs and credentials stay server-side.

  // Fetch PortalTheme for block-based customizer (graceful fallback if table not yet migrated)
  let portalTheme: { draftConfig: unknown; publishedConfig: unknown; publishedAt: Date | null } | null = null;
  try {
    portalTheme = await prisma.portalTheme.findUnique({
      where: { tenantId: tenant.id },
      select: {
        draftConfig: true,
        publishedConfig: true,
        publishedAt: true,
      },
    });
  } catch {
    // portal_themes table not yet migrated — fall back to legacy rendering
  }

  // Resolve the active theme config (draft for preview, published for public view)
  const resolvedThemeConfig = resolveTenantPortalTheme({
    portalTheme,
    legacyTenantFields: tenant as Record<string, unknown>,
    mode: isPreviewMode ? "customizer" : "public",
  });

  const serializedTenant = {
    name: tenant.name,
    subdomain: tenant.subdomain,
    themeColor: tenant.themeColor,
    logoUrl: tenant.logoUrl,
    heroImageUrl: tenant.heroImageUrl,
    heroText: tenant.heroText,
    backgroundImageUrl: tenant.backgroundImageUrl,
    whatsappNumber: tenant.whatsappNumber,
    contactEmail: tenant.contactEmail,
    instagramHandle: tenant.instagramHandle,
    aboutText: tenant.aboutText,
    catalogTitle: tenant.catalogTitle,
    catalogSubtitle: tenant.catalogSubtitle,
    footerText: tenant.footerText,
    problemStatement: tenant.problemStatement,
    solutionStatement: tenant.solutionStatement,
    uspText: tenant.uspText,
    features: tenant.features,
    testimonials: tenant.testimonials,
    faqs: tenant.faqs,
    layoutStyle: tenant.layoutStyle,
    fontFamily: tenant.fontFamily,
    themeMode: tenant.themeMode,
    borderRadius: tenant.borderRadius,
    animationStyle: tenant.animationStyle,
    animationDirection: tenant.animationDirection,
    iconStyle: tenant.iconStyle,
    themeConfig: tenant.themeConfig,
    portalThemeConfig: resolvedThemeConfig,
    storefrontPickupEnabled: tenant.storefrontPickupEnabled,
    storefrontDeliveryEnabled: tenant.storefrontDeliveryEnabled,
    storefrontFlatShippingRate: Number(tenant.storefrontFlatShippingRate),
    storefrontFreeShippingMinimum: tenant.storefrontFreeShippingMinimum === null ? null : Number(tenant.storefrontFreeShippingMinimum),
    storefrontTaxRate: Number(tenant.storefrontTaxRate),
    paymentMethods: tenant.tenantPaymentMethods,
    products: tenant.products.map(product => ({
      ...product,
      price: product.price ? Number(product.price) : null,
      priceSilver: product.priceSilver ? Number(product.priceSilver) : null,
      priceGold: product.priceGold ? Number(product.priceGold) : null,
      stockKg: product.stockKg ? Number(product.stockKg) : null,
      stockUnit: product.stockUnit ? Number(product.stockUnit) : null,
    })),
    offerings: tenant.offerings.map(offering => ({
      ...offering,
      grindOptions: offering.grindOptions,
      variants: offering.variants.map(variant => ({
        ...variant,
        netWeightGrams: Number(variant.netWeightGrams),
        unitPrice: Number(variant.unitPrice),
      })),
    })),
  };

  // Type cast back to any or specific shape since Client component expects Decimal type structurally
  // (Prisma types on client actually accept numbers for Decimals usually, or we can just cast to any)
  return (
    <TenantPortalClient
      tenant={serializedTenant as any}
    />
  );
}
