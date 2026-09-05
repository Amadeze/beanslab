export type PlanTier = "TRIAL" | "BASIC" | "PRO" | "ENTERPRISE";
export type PlanFeature =
  | "CORE_OPERATIONS"
  | "STOREFRONT"
  | "REPORT_EXPORTS"
  | "ADVANCED_REPORTS"
  | "MIDTRANS"
  | "ARTISAN"
  | "CUSTOM_DOMAIN";

export interface PlanCapacity {
  /** Hard cap on the number of active users for this plan. */
  maxUsers: number;
  /** Hard cap on the number of roasting batches the tenant can create in a single calendar month. */
  maxMonthlyRoastBatches: number;
  /** Hard cap on the number of invoices the tenant can issue in a single calendar month. */
  maxMonthlyInvoices: number;
  /** White-label (custom domain + branded portal). Separate add-on. */
  whiteLabel: boolean;
}

export interface PlanDefinition extends PlanCapacity {
  label: string;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  features: readonly PlanFeature[];
}

export const PLAN_CATALOG = {
  TRIAL: {
    label: "Trial",
    monthlyPrice: 0,
    yearlyPrice: null,
    maxUsers: 5,
    maxMonthlyRoastBatches: 200,
    maxMonthlyInvoices: 500,
    whiteLabel: false,
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
    maxUsers: 3,
    maxMonthlyRoastBatches: 80,
    maxMonthlyInvoices: 200,
    whiteLabel: false,
    features: ["CORE_OPERATIONS", "STOREFRONT", "REPORT_EXPORTS"],
  },
  PRO: {
    label: "Pro",
    monthlyPrice: 355_000,
    yearlyPrice: 3_500_000, // Rp 3.500.000/tahun (~Rp 291.667/bulan)
    maxUsers: 15,
    maxMonthlyRoastBatches: 1_000,
    maxMonthlyInvoices: 5_000,
    whiteLabel: false,
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
    maxUsers: 100,
    maxMonthlyRoastBatches: 10_000,
    maxMonthlyInvoices: 50_000,
    whiteLabel: true,
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
} as const satisfies Record<PlanTier, PlanDefinition>;

export function planHasFeature(tier: PlanTier, feature: PlanFeature) {
  return (PLAN_CATALOG[tier].features as readonly PlanFeature[]).includes(feature);
}

export function planCapacity(tier: PlanTier): PlanCapacity {
  const def = PLAN_CATALOG[tier];
  return {
    maxUsers: def.maxUsers,
    maxMonthlyRoastBatches: def.maxMonthlyRoastBatches,
    maxMonthlyInvoices: def.maxMonthlyInvoices,
    whiteLabel: def.whiteLabel,
  };
}
