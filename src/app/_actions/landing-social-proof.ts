/**
 * Landing page social proof — server-side data fetch.
 *
 * Reads tenants that have explicitly opted in (showOnLanding = true),
 * are currently on an active subscription, and have a valid logo URL.
 * Results are cached for 1 hour to avoid hammering the DB on every page load.
 *
 * Privacy guarantee: only tenants that have set showOnLanding = true will ever
 * appear here. The field defaults to false and must be actively enabled by the
 * tenant owner in Settings.
 */

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

export type LandingSocialProofItem = {
  id: string;
  displayName: string;
  logoUrl: string;
};

const CACHE_TAG = "landing-social-proof";
const REVALIDATE_SECONDS = 60 * 60; // 1 hour

async function _fetchSocialProof(): Promise<LandingSocialProofItem[]> {
  try {
    const tenants = await prisma.tenant.findMany({
      where: {
        showOnLanding: true,
        subscriptionStatus: "ACTIVE",
        landingLogoUrl: { not: null },
      },
      select: {
        id: true,
        name: true,
        landingLogoUrl: true,
        landingDisplayName: true,
      },
      take: 12,
      orderBy: { updatedAt: "desc" },
    });

    return tenants
      .filter((t) => t.landingLogoUrl)
      .map((t) => ({
        id: t.id,
        displayName: t.landingDisplayName || t.name,
        logoUrl: t.landingLogoUrl!,
      }));
  } catch {
    // Fail gracefully — social proof is non-critical; the landing page renders
    // a text fallback if this returns an empty array.
    return [];
  }
}

export const fetchLandingSocialProof = unstable_cache(
  _fetchSocialProof,
  [CACHE_TAG],
  { revalidate: REVALIDATE_SECONDS, tags: [CACHE_TAG] },
);
