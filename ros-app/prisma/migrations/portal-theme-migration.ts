// =============================================================================
// PORTAL THEME MIGRATION SCRIPT
// Converts legacy Tenant fields to PortalTheme records
//
// Usage:
//   tsx prisma/migrations/portal-theme-migration.ts --dry-run
//   tsx prisma/migrations/portal-theme-migration.ts
// =============================================================================

import { PrismaClient } from "@prisma/client";
import { convertLegacyTenantToThemeConfig } from "../../src/features/portal-theme/migrations/legacy-converter";

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes("--dry-run");

interface MigrationStats {
  checked: number;
  migrated: number;
  skipped: number;
  failed: number;
}

async function migrate() {
  console.log(`\n${DRY_RUN ? "🔍 DRY RUN MODE" : "🚀 RUNNING MIGRATION"}\n`);

  const stats: MigrationStats = { checked: 0, migrated: 0, skipped: 0, failed: 0 };

  try {
    // Find all active tenants
    const tenants = await prisma.tenant.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        subdomain: true,
        themeColor: true,
        heroImageUrl: true,
        heroText: true,
        backgroundImageUrl: true,
        aboutText: true,
        catalogTitle: true,
        catalogSubtitle: true,
        footerText: true,
        logoUrl: true,
        layoutStyle: true,
        fontFamily: true,
        themeMode: true,
        borderRadius: true,
        animationStyle: true,
        animationDirection: true,
        iconStyle: true,
        themeConfig: true,
        problemStatement: true,
        solutionStatement: true,
        uspText: true,
        features: true,
        testimonials: true,
        faqs: true,
        whatsappNumber: true,
        contactEmail: true,
        instagramHandle: true,
        portalTheme: true,
      },
    });

    console.log(`Found ${tenants.length} active tenants\n`);

    for (const tenant of tenants) {
      stats.checked++;

      // Skip if PortalTheme already exists
      if (tenant.portalTheme) {
        console.log(`  ⏭  ${tenant.name} (${tenant.subdomain}) — PortalTheme already exists, skipping`);
        stats.skipped++;
        continue;
      }

      try {
        const config = convertLegacyTenantToThemeConfig(tenant);

        if (DRY_RUN) {
          console.log(`  🔍 ${tenant.name} (${tenant.subdomain}) — Would create PortalTheme with ${config.sections.length} sections`);
          stats.migrated++;
          continue;
        }

        await prisma.portalTheme.create({
          data: {
            tenantId: tenant.id,
            name: "Default Theme",
            schemaVersion: 1,
            draftConfig: config as any,
            publishedConfig: config as any,
            publishedAt: new Date(),
          },
        });

        console.log(`  ✅ ${tenant.name} (${tenant.subdomain}) — Migrated with ${config.sections.length} sections`);
        stats.migrated++;
      } catch (err) {
        console.error(`  ❌ ${tenant.name} (${tenant.subdomain}) — Failed:`, err);
        stats.failed++;
      }
    }

    console.log(`\n${"─".repeat(50)}`);
    console.log(`Migration complete:`);
    console.log(`  Checked:  ${stats.checked}`);
    console.log(`  Migrated: ${stats.migrated}`);
    console.log(`  Skipped:  ${stats.skipped}`);
    console.log(`  Failed:   ${stats.failed}`);
    console.log(`${"─".repeat(50)}\n`);

  } finally {
    await prisma.$disconnect();
  }
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
