import type { Metadata } from "next";
import type { CatalogOffering, CatalogProduct } from "./storefront-catalog";

export type StorefrontSeoTenant = {
  name: string;
  logoUrl?: string | null;
  heroImageUrl?: string | null;
  heroText?: string | null;
  aboutText?: string | null;
  catalogSubtitle?: string | null;
  contactEmail?: string | null;
  instagramHandle?: string | null;
};

type StorefrontMetadataInput = {
  tenant: StorefrontSeoTenant;
  canonicalUrl: string;
  isPreview: boolean;
};

type StorefrontStructuredDataInput = {
  tenant: StorefrontSeoTenant;
  canonicalUrl: string;
  products: CatalogProduct[];
  offerings: CatalogOffering[];
};

function firstMeaningfulText(...values: Array<string | null | undefined>) {
  return values.map((value) => value?.trim()).find(Boolean);
}

function publicUrl(value: string | null | undefined, canonicalUrl: string) {
  if (!value) return undefined;
  try {
    const resolved = new URL(value, canonicalUrl);
    return resolved.protocol === "http:" || resolved.protocol === "https:"
      ? resolved.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function storefrontDescription(tenant: StorefrontSeoTenant) {
  const description = firstMeaningfulText(
    tenant.aboutText,
    tenant.catalogSubtitle,
    tenant.heroText,
    `Katalog resmi ${tenant.name}.`,
  )!.replace(/\s+/g, " ");
  if (description.length <= 160) return description;
  const shortened = description.slice(0, 157);
  const wordBoundary = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, wordBoundary > 120 ? wordBoundary : 157)}…`;
}

export function buildStorefrontMetadata({
  tenant,
  canonicalUrl,
  isPreview,
}: StorefrontMetadataInput): Metadata {
  const description = storefrontDescription(tenant);
  const socialImage = publicUrl(tenant.heroImageUrl || tenant.logoUrl, canonicalUrl);
  const images = socialImage
    ? [{ url: socialImage, alt: tenant.name }]
    : undefined;

  return {
    title: { absolute: tenant.name },
    description,
    alternates: { canonical: canonicalUrl },
    robots: isPreview
      ? { index: false, follow: false, noarchive: true }
      : { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: "id_ID",
      title: tenant.name,
      description,
      siteName: tenant.name,
      url: canonicalUrl,
      images,
    },
    twitter: {
      card: socialImage ? "summary_large_image" : "summary",
      title: tenant.name,
      description,
      images: socialImage ? [socialImage] : undefined,
    },
    icons: { icon: publicUrl(tenant.logoUrl, canonicalUrl) || "/favicon.ico" },
  };
}

function availabilityFromStock(product: CatalogProduct) {
  const stock = product.stockUnit ?? product.stockKg;
  if (stock == null) return undefined;
  return stock > 0
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock";
}

function productNode(product: CatalogProduct, canonicalUrl: string) {
  if (product.price == null || product.price <= 0) return null;
  return {
    "@type": "Product",
    "@id": `${canonicalUrl}#product-${product.id}`,
    name: product.name,
    description: product.description || undefined,
    image: publicUrl(product.imageUrl, canonicalUrl),
    sku: product.code,
    category: product.category || undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: "IDR",
      price: product.price,
      availability: availabilityFromStock(product),
      url: `${canonicalUrl}#catalog`,
    },
  };
}

function offeringNode(offering: CatalogOffering, canonicalUrl: string) {
  const prices = offering.variants
    .map((variant) => Number(variant.unitPrice))
    .filter((price) => Number.isFinite(price) && price > 0);
  if (prices.length === 0) return null;
  return {
    "@type": "Product",
    "@id": `${canonicalUrl}#offering-${offering.id}`,
    name: offering.name,
    description: offering.description || undefined,
    image: publicUrl(offering.imageUrl, canonicalUrl),
    sku: offering.code,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "IDR",
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      offerCount: prices.length,
      availability: offering.availableKg == null
        ? undefined
        : offering.availableKg > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      url: `${canonicalUrl}#catalog`,
    },
  };
}

export function buildStorefrontStructuredData({
  tenant,
  canonicalUrl,
  products,
  offerings,
}: StorefrontStructuredDataInput) {
  const catalogItems = [
    ...products.map((product) => productNode(product, canonicalUrl)),
    ...offerings.map((offering) => offeringNode(offering, canonicalUrl)),
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  const sameAs = tenant.instagramHandle
    ? [`https://instagram.com/${tenant.instagramHandle.replace(/^@/, "")}`]
    : undefined;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "OnlineStore",
        "@id": `${canonicalUrl}#store`,
        name: tenant.name,
        url: canonicalUrl,
        description: storefrontDescription(tenant),
        logo: publicUrl(tenant.logoUrl, canonicalUrl),
        image: publicUrl(tenant.heroImageUrl, canonicalUrl),
        email: tenant.contactEmail || undefined,
        sameAs,
      },
      ...(catalogItems.length > 0
        ? [{
            "@type": "ItemList",
            "@id": `${canonicalUrl}#catalog`,
            name: `Katalog ${tenant.name}`,
            numberOfItems: catalogItems.length,
            itemListElement: catalogItems.map((item, index) => ({
              "@type": "ListItem",
              position: index + 1,
              item,
            })),
          }]
        : []),
    ],
  };
}

export function serializeStorefrontStructuredData(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
