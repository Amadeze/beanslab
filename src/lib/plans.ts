export type PlanTier = "TRIAL" | "BASIC" | "PRO" | "ENTERPRISE";
export type PlanFeature =
  | "CORE_OPERATIONS"
  | "STOREFRONT"
  | "REPORT_EXPORTS"
  | "ADVANCED_REPORTS"
  | "MIDTRANS"
  | "ARTISAN"
  | "CUSTOM_DOMAIN";

export const PLAN_CATALOG = {
  TRIAL: {
    label: "Trial",
    monthlyPrice: 0,
    yearlyPrice: null,
    features: [
      "CORE_OPERATIONS",
      "STOREFRONT",
      "REPORT_EXPORTS",
      "ADVANCED_REPORTS",
      "MIDTRANS",
      "ARTISAN",
      "CUSTOM_DOMAIN",
    ],
  },
  BASIC: {
    label: "Basic (Legacy)",
    monthlyPrice: 149_000,
    yearlyPrice: null,
    features: ["CORE_OPERATIONS", "STOREFRONT", "REPORT_EXPORTS"],
  },
  PRO: {
    label: "Pro",
    monthlyPrice: 355_000,
    yearlyPrice: 3_500_000, // Rp 3.500.000/tahun (~Rp 291.667/bulan)
    features: [
      "CORE_OPERATIONS",
      "STOREFRONT",
      "REPORT_EXPORTS",
      "ADVANCED_REPORTS",
      "MIDTRANS",
      "ARTISAN",
      "CUSTOM_DOMAIN",
    ],
  },
  ENTERPRISE: {
    label: "Enterprise (Legacy)",
    monthlyPrice: null,
    yearlyPrice: null,
    features: [
      "CORE_OPERATIONS",
      "STOREFRONT",
      "REPORT_EXPORTS",
      "ADVANCED_REPORTS",
      "MIDTRANS",
      "ARTISAN",
      "CUSTOM_DOMAIN",
    ],
  },
} as const satisfies Record<
  PlanTier,
  { label: string; monthlyPrice: number | null; yearlyPrice: number | null; features: readonly PlanFeature[] }
>;

export function planHasFeature(tier: PlanTier, feature: PlanFeature) {
  return (PLAN_CATALOG[tier].features as readonly PlanFeature[]).includes(feature);
}
