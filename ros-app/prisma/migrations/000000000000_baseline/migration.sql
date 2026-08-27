-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPERADMIN', 'OWNER', 'MANAGER', 'OPERATOR', 'CASHIER');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('TRIAL', 'BASIC', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('GREEN_BEAN', 'ROASTED_BEAN', 'FINISHED_GOODS', 'PACKAGING');

-- CreateEnum
CREATE TYPE "RoastLevel" AS ENUM ('LIGHT', 'MEDIUM', 'MEDIUM_DARK', 'DARK');

-- CreateEnum
CREATE TYPE "GrindSize" AS ENUM ('WHOLE_BEAN', 'COARSE', 'MEDIUM_COARSE', 'MEDIUM', 'MEDIUM_FINE', 'FINE', 'ESPRESSO', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MaterialOrigin" AS ENUM ('INTERNAL_ROAST', 'PURCHASED_ROASTED');

-- CreateEnum
CREATE TYPE "PurchaseType" AS ENUM ('GREEN_BEAN', 'ROASTED_BEAN', 'PACKAGING', 'SUPPLY');

-- CreateEnum
CREATE TYPE "InventorySupplyCategory" AS ENUM ('PACKAGING', 'INGREDIENT', 'CONSUMABLE', 'MERCHANDISE', 'SPARE_PART', 'EQUIPMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "SupplyBaseUnit" AS ENUM ('KG', 'GRAM', 'LITER', 'METER', 'ROLL', 'PCS', 'BOX', 'SET', 'OTHER');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'VOID');

-- CreateEnum
CREATE TYPE "RoastLifecycleStatus" AS ENUM ('PLANNED', 'RESERVED', 'CHARGED', 'COMPLETED', 'ABORTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RoastMaterialReservationStatus" AS ENUM ('ACTIVE', 'CHARGED', 'RELEASED', 'CONSUMED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIAL', 'PAID', 'VOID', 'RETURNED');

-- CreateEnum
CREATE TYPE "TaxType" AS ENUM ('PPN', 'PPH_21', 'PPH_23', 'PPH_4_2', 'NONE');

-- CreateEnum
CREATE TYPE "CustomerTier" AS ENUM ('RETAIL', 'WHOLESALE_SILVER', 'WHOLESALE_GOLD');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'QRIS', 'CREDIT');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('MANUAL', 'MIDTRANS', 'XENDIT');

-- CreateEnum
CREATE TYPE "PaymentSubmissionStatus" AS ENUM ('AWAITING_PROOF', 'AWAITING_VERIFICATION', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentNotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "ShippingMethod" AS ENUM ('PICKUP', 'LOCAL_DELIVERY', 'STORE_COURIER', 'COURIER');

-- CreateEnum
CREATE TYPE "StockReservationStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'RELEASED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "FulfillmentStatus" AS ENUM ('AWAITING_PAYMENT', 'PAID', 'NEEDS_PRODUCTION', 'READY_TO_PACK', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FulfillmentTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchasePaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "SalePriceSource" AS ENUM ('BASE', 'TIER', 'CONTRACT');

-- CreateEnum
CREATE TYPE "JobRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "JournalRefType" AS ENUM ('INVOICE', 'PAYMENT', 'CREDIT_NOTE', 'EXPENSE', 'CAPITAL', 'CAPITAL_WITHDRAWAL', 'SUPPLIER_PAYMENT', 'SAMPLE_USAGE', 'ADJUSTMENT', 'PRODUCTION', 'ROASTING', 'GRINDING', 'EXPERIMENTAL', 'SALE', 'PURCHASE', 'VOID_REVERSAL');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('GAJI', 'UTILITAS', 'OPERASIONAL', 'LAINNYA');

-- CreateEnum
CREATE TYPE "CapitalTransactionType" AS ENUM ('INITIAL', 'INJECTION', 'WITHDRAWAL', 'DIVIDEND');

-- CreateEnum
CREATE TYPE "StudioStatus" AS ENUM ('ONLINE', 'OFFLINE', 'REVOKED');

-- CreateEnum
CREATE TYPE "StudioDeviceAuthorizationStatus" AS ENUM ('PENDING', 'APPROVED', 'CONSUMED', 'DENIED');

-- CreateEnum
CREATE TYPE "ArtisanImportStatus" AS ENUM ('UPLOADED', 'PARSING', 'IMPORTED', 'DUPLICATE', 'FAILED');

-- CreateEnum
CREATE TYPE "RoastMatchStatus" AS ENUM ('ON_TRACK', 'WATCH', 'DIVERGED', 'INVALID');

-- CreateEnum
CREATE TYPE "LedgerRefType" AS ENUM ('PURCHASE_GB', 'PURCHASE_RB', 'PURCHASE_PKG', 'ROASTING_GB_OUT', 'ROASTING_RB_IN', 'PRODUCTION_RB_OUT', 'PRODUCTION_PKG_OUT', 'PRODUCTION_FG_IN', 'SALE_FG_OUT', 'SAMPLE_RB_OUT', 'SAMPLE_FG_OUT', 'SAMPLE_PKG_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'VOID_REVERSAL', 'RETURN_FG_IN', 'RETURN_PKG_IN', 'SUPPLY_PURCHASE_IN', 'SUPPLY_PRODUCTION_OUT', 'SUPPLY_ADJUSTMENT_IN', 'SUPPLY_ADJUSTMENT_OUT', 'GRINDING_RB_OUT', 'GRINDING_FG_IN', 'EXPERIMENTAL_COMPONENT_OUT', 'EXPERIMENTAL_FG_IN', 'LOCATION_OPNAME_IN', 'LOCATION_OPNAME_OUT');

-- CreateEnum
CREATE TYPE "OfferingSourceMode" AS ENUM ('INTERNAL_ROAST', 'PURCHASED_ROASTED');

-- CreateEnum
CREATE TYPE "SalesChannel" AS ENUM ('WALK_IN', 'WHATSAPP', 'MARKETPLACE', 'B2B_DIRECT', 'STOREFRONT', 'OTHER');

-- CreateEnum
CREATE TYPE "POStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIAL', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LiveSessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'RECONCILED');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "CuppingCategory" AS ENUM ('FRAGRANCE', 'AROMA', 'FLAVOR', 'AFTERTASTE', 'ACIDITY', 'BODY', 'BALANCE', 'UNIFORMITY', 'CLEAN_CUP', 'SWEETNESS', 'OVERALL');

-- CreateEnum
CREATE TYPE "LocationTransferStatus" AS ENUM ('PENDING', 'COMPLETED', 'VOID');

-- CreateEnum
CREATE TYPE "LocationOpnameStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subdomain" TEXT,
    "themeColor" TEXT NOT NULL DEFAULT 'amber',
    "logoUrl" TEXT,
    "heroImageUrl" TEXT,
    "heroText" TEXT,
    "backgroundImageUrl" TEXT,
    "whatsappNumber" TEXT,
    "contactEmail" TEXT,
    "instagramHandle" TEXT,
    "aboutText" TEXT,
    "catalogTitle" TEXT,
    "catalogSubtitle" TEXT,
    "footerText" TEXT,
    "problemStatement" TEXT,
    "solutionStatement" TEXT,
    "uspText" TEXT,
    "features" JSONB,
    "testimonials" JSONB,
    "faqs" JSONB,
    "midtransClientKey" TEXT,
    "midtransServerKey" TEXT,
    "midtransIsProduction" BOOLEAN NOT NULL DEFAULT false,
    "xenditSubAccountId" TEXT,
    "xenditEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isArtisanEnabled" BOOLEAN NOT NULL DEFAULT false,
    "artisanWebhookToken" TEXT,
    "artisanWebhookTokenHash" TEXT,
    "layoutStyle" TEXT NOT NULL DEFAULT 'modern',
    "fontFamily" TEXT NOT NULL DEFAULT 'sans',
    "themeMode" TEXT NOT NULL DEFAULT 'light',
    "borderRadius" TEXT NOT NULL DEFAULT 'md',
    "animationStyle" TEXT NOT NULL DEFAULT 'subtle',
    "animationDirection" TEXT NOT NULL DEFAULT 'up',
    "iconStyle" TEXT NOT NULL DEFAULT 'regular',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "themeConfig" JSONB,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    "locale" TEXT NOT NULL DEFAULT 'id-ID',
    "storefrontPickupEnabled" BOOLEAN NOT NULL DEFAULT true,
    "storefrontDeliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "storefrontFlatShippingRate" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "storefrontFreeShippingMinimum" DECIMAL(14,2),
    "storefrontTaxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "storefrontReservationMinutes" INTEGER NOT NULL DEFAULT 1440,
    "taxEnabled" BOOLEAN NOT NULL DEFAULT false,
    "defaultTaxRate" DECIMAL(5,2) NOT NULL DEFAULT 11,
    "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'TRIAL',
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "trialEndsAt" TIMESTAMP(3),
    "nextBillingDate" TIMESTAMP(3),
    "setupCompletedAt" TIMESTAMP(3),
    "ownerCapital" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "initialCash" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_themes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default Theme',
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "draftConfig" JSONB NOT NULL,
    "publishedConfig" JSONB,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_themes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_roast_levels" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_roast_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machines" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "capacityKg" DECIMAL(8,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "machines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roast_profiles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "machineId" TEXT,
    "roastLevel" TEXT NOT NULL,
    "beanOrigin" TEXT,
    "chargeTemp" DECIMAL(5,2),
    "targetFirstCrackStart" INTEGER,
    "targetFirstCrackEnd" INTEGER,
    "developmentTarget" DECIMAL(5,2),
    "dropTemp" DECIMAL(5,2),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roast_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_payments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "midtransOrderId" TEXT NOT NULL,
    "paymentUrl" TEXT,
    "tier" "SubscriptionTier" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "googleId" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'OPERATOR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "province" TEXT,
    "city" TEXT,
    "district" TEXT,
    "postalCode" TEXT,
    "tier" "CustomerTier" NOT NULL DEFAULT 'RETAIL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "province" TEXT,
    "city" TEXT,
    "district" TEXT,
    "postalCode" TEXT,
    "region" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coffee_sources" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "region" TEXT,
    "farm" TEXT,
    "species" TEXT,
    "varietal" TEXT,
    "processMethod" TEXT,
    "fermentationMethod" TEXT,
    "elevation" TEXT,
    "cropYear" TEXT,
    "certifications" TEXT[],
    "tastingNotes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "coffee_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coffee_offerings" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "coffeeSourceId" TEXT NOT NULL,
    "sourceMode" "OfferingSourceMode" NOT NULL,
    "roastLevel" TEXT,
    "lineageProductId" TEXT,
    "grindOptions" "GrindSize"[] DEFAULT ARRAY['WHOLE_BEAN']::"GrindSize"[],
    "allowCustomGrind" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "coffee_offerings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offering_variants" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "supplyItemId" TEXT,
    "packageName" TEXT NOT NULL,
    "netWeightGrams" DECIMAL(8,2) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "offering_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProductType" NOT NULL,
    "coffeeSpecies" TEXT,
    "category" TEXT,
    "origin" TEXT,
    "roastLevel" TEXT,
    "sourceGreenBeanId" TEXT,
    "coffeeSourceId" TEXT,
    "materialOrigin" "MaterialOrigin",
    "description" TEXT,
    "imageUrl" TEXT,
    "price" DECIMAL(12,2) DEFAULT 0,
    "priceSilver" DECIMAL(12,2) DEFAULT 0,
    "priceGold" DECIMAL(12,2) DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stockUnit" INTEGER NOT NULL DEFAULT 0,
    "stockKg" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "lastHpp" DECIMAL(12,2),
    "avgCostPerKg" DECIMAL(12,2) DEFAULT 0,
    "reorderAlertEnabled" BOOLEAN NOT NULL DEFAULT false,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 7,
    "safetyStockQuantity" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "reorderLookbackDays" INTEGER NOT NULL DEFAULT 30,
    "shelfLifeDays" INTEGER,
    "netWeightGrams" DECIMAL(8,2),
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packagings" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weightGrams" DECIMAL(8,2) NOT NULL,
    "costPerUnit" DECIMAL(12,2) NOT NULL,
    "avgCostPerUnit" DECIMAL(12,2) DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stockUnit" INTEGER NOT NULL DEFAULT 0,
    "reorderAlertEnabled" BOOLEAN NOT NULL DEFAULT false,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 7,
    "safetyStockQuantity" INTEGER NOT NULL DEFAULT 0,
    "reorderLookbackDays" INTEGER NOT NULL DEFAULT 30,
    "supplyItemId" TEXT,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "packagings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_supply_items" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "InventorySupplyCategory" NOT NULL,
    "baseUnit" "SupplyBaseUnit" NOT NULL,
    "trackLot" BOOLEAN NOT NULL DEFAULT true,
    "shelfLifeDays" INTEGER,
    "consumableInProduction" BOOLEAN NOT NULL DEFAULT false,
    "includeInProductHpp" BOOLEAN NOT NULL DEFAULT false,
    "isSellable" BOOLEAN NOT NULL DEFAULT false,
    "capacityGrams" DECIMAL(8,2),
    "tareWeightGrams" DECIMAL(8,2),
    "costPerUnit" DECIMAL(12,2) NOT NULL,
    "avgCostPerUnit" DECIMAL(12,2) DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stockQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "reorderAlertEnabled" BOOLEAN NOT NULL DEFAULT false,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 7,
    "safetyStockQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "reorderLookbackDays" INTEGER NOT NULL DEFAULT 30,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "inventory_supply_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "packagingId" TEXT NOT NULL,
    "outputGrams" DECIMAL(8,2) NOT NULL,
    "storefrontGrindOptions" "GrindSize"[] DEFAULT ARRAY['WHOLE_BEAN']::"GrindSize"[],
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_items" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "ratioPercent" DECIMAL(5,2) NOT NULL,
    "gramsPerUnit" DECIMAL(8,3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "recipe_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_supply_items" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "supplyItemId" TEXT NOT NULL,
    "quantityPerUnit" DECIMAL(12,3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "recipe_supply_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "operationKey" TEXT,
    "type" "PurchaseType" NOT NULL,
    "supplierId" TEXT NOT NULL,
    "productId" TEXT,
    "packagingId" TEXT,
    "supplyItemId" TEXT,
    "weightKg" DECIMAL(10,3),
    "quantityUnits" INTEGER,
    "supplyQuantity" DECIMAL(12,3),
    "pricePerUnit" DECIMAL(12,2) NOT NULL,
    "shippingCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(14,2) NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "paymentStatus" "PurchasePaymentStatus" NOT NULL DEFAULT 'PAID',
    "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "voidReason" TEXT,
    "voidAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purchaseOrderId" TEXT,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parent_roasting_batches" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "operationKey" TEXT,
    "tenantId" TEXT NOT NULL,
    "inputProductId" TEXT NOT NULL,
    "targetWeightKg" DECIMAL(10,3) NOT NULL,
    "outputProductId" TEXT NOT NULL,
    "actualOutputKg" DECIMAL(10,3),
    "totalShrinkagePercent" DECIMAL(5,2),
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "lifecycleStatus" "RoastLifecycleStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "voidReason" TEXT,
    "voidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "machineId" TEXT,
    "referenceRoastId" TEXT,
    "referenceProfileId" TEXT,
    "profileSnapshot" JSONB,

    CONSTRAINT "parent_roasting_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roast_material_reservations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "parentBatchId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "sourceLocationId" TEXT NOT NULL,
    "quantityKg" DECIMAL(12,3) NOT NULL,
    "status" "RoastMaterialReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "chargeTransferId" TEXT,
    "releasedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roast_material_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_roasting_batches" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "artisanEventId" TEXT,
    "roastDuration" INTEGER,
    "dropTemp" DECIMAL(5,2),
    "roastId" TEXT,
    "matchScore" DOUBLE PRECISION,
    "matchStatus" "RoastMatchStatus",
    "matchDetails" JSONB,
    "matchedAt" TIMESTAMP(3),
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "child_roasting_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_batches" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "operationKey" TEXT,
    "recipeId" TEXT,
    "outputProductId" TEXT NOT NULL,
    "packagingId" TEXT NOT NULL,
    "parentRoastBatchId" TEXT,
    "unitsProduced" INTEGER NOT NULL,
    "totalRbUsedKg" DECIMAL(10,3) NOT NULL,
    "hppPerUnit" DECIMAL(12,2) NOT NULL,
    "laborCost" DECIMAL(14,2) DEFAULT 0,
    "overheadAllocated" DECIMAL(14,2) DEFAULT 0,
    "status" "TransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "producedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "voidReason" TEXT,
    "voidAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "production_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grinding_batches" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "operationKey" TEXT,
    "tenantId" TEXT NOT NULL,
    "sourceProductId" TEXT NOT NULL,
    "outputProductId" TEXT NOT NULL,
    "parentRoastBatchId" TEXT,
    "grindSize" "GrindSize" NOT NULL,
    "customGrindLabel" TEXT,
    "grinderId" TEXT,
    "operatorId" TEXT NOT NULL,
    "inputKg" DECIMAL(10,3) NOT NULL,
    "outputKg" DECIMAL(10,3) NOT NULL,
    "lossKg" DECIMAL(10,3) NOT NULL,
    "grindingCost" DECIMAL(14,2) DEFAULT 0,
    "batchReference" TEXT,
    "notes" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grinding_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experimental_productions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "operationKey" TEXT,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "outputProductId" TEXT NOT NULL,
    "parentRoastBatchId" TEXT,
    "inputKg" DECIMAL(10,3) NOT NULL,
    "outputKg" DECIMAL(10,3) NOT NULL,
    "lossKg" DECIMAL(10,3) NOT NULL,
    "hppPerUnit" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "experimental_productions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experimental_production_components" (
    "id" TEXT NOT NULL,
    "experimentalProductionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "productId" TEXT,
    "supplyItemId" TEXT,
    "quantityKg" DECIMAL(10,3),
    "quantityUnit" DECIMAL(65,30),
    "supplyQuantity" DECIMAL(12,3),
    "unitCostSnapshot" DECIMAL(12,2) NOT NULL,
    "totalCostSnapshot" DECIMAL(14,2) NOT NULL,
    "lotId" TEXT,
    "lotNumber" TEXT,
    "notes" TEXT,

    CONSTRAINT "experimental_production_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_supply_usages" (
    "id" TEXT NOT NULL,
    "productionBatchId" TEXT NOT NULL,
    "supplyItemId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitCostSnapshot" DECIMAL(12,2) NOT NULL,
    "totalCostSnapshot" DECIMAL(14,2) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "production_supply_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "operationKey" TEXT,
    "customerId" TEXT NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "shippingCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "shippingMethod" "ShippingMethod",
    "shippingAddress" TEXT,
    "courierName" TEXT,
    "trackingNumber" TEXT,
    "publicOrderToken" TEXT,
    "fulfillmentStatus" "FulfillmentStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "reservationExpiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "packedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "grandTotal" DECIMAL(14,2) NOT NULL,
    "taxType" "TaxType" NOT NULL DEFAULT 'NONE',
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxableAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "pphType" TEXT,
    "pphWithholding" DECIMAL(14,2),
    "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "returnedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "salesChannel" "SalesChannel" NOT NULL DEFAULT 'WALK_IN',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "voidReason" TEXT,
    "voidAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    "midtransOrderId" TEXT,
    "paymentUrl" TEXT,
    "paymentMethod" TEXT,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_reservations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "quantityKg" DECIMAL(10,3),
    "status" "StockReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fulfillment_tasks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "requestedQuantity" INTEGER NOT NULL,
    "reservedQuantity" INTEGER NOT NULL,
    "shortageQuantity" INTEGER NOT NULL,
    "status" "FulfillmentTaskStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fulfillment_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "hpp" DECIMAL(12,2) NOT NULL,
    "priceSource" "SalePriceSource" NOT NULL DEFAULT 'BASE',
    "contractPriceId" TEXT,
    "grindSize" "GrindSize",
    "customGrindLabel" TEXT,
    "offeringId" TEXT,
    "offeringVariantId" TEXT,
    "offeringName" TEXT,
    "packageName" TEXT,
    "netWeightGrams" DECIMAL(8,2),
    "roastLevel" TEXT,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "operationKey" TEXT,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "reference" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "voidReason" TEXT,
    "voidAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_payment_methods" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'MANUAL',
    "method" "PaymentMethod" NOT NULL,
    "label" TEXT NOT NULL,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "accountHolder" TEXT,
    "qrisImageUrl" TEXT,
    "instructions" TEXT,
    "requireProof" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_submissions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "paymentMethodId" TEXT,
    "paymentId" TEXT,
    "publicToken" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'MANUAL',
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentSubmissionStatus" NOT NULL DEFAULT 'AWAITING_PROOF',
    "amount" DECIMAL(14,2) NOT NULL,
    "declaredAmount" DECIMAL(14,2),
    "reviewedAmount" DECIMAL(14,2),
    "payerName" TEXT,
    "reference" TEXT,
    "proofSha256" TEXT,
    "suspectedDuplicateOfId" TEXT,
    "destination" JSONB,
    "proofObjectPath" TEXT,
    "proofMimeType" TEXT,
    "proofFilename" TEXT,
    "submissionAttempt" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "rejectionReason" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_notification_deliveries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentSubmissionId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "status" "PaymentNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "providerMessageId" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_notes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "operationKey" TEXT,
    "reason" TEXT NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_note_items" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "unitDiscount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "credit_note_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_payments" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "operationKey" TEXT,
    "purchaseId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "reference" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "voidReason" TEXT,
    "voidAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "supplier_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_snapshots" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lots" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT,
    "packagingId" TEXT,
    "supplyItemId" TEXT,
    "supplierId" TEXT,
    "batchCode" TEXT NOT NULL,
    "purchaseId" TEXT,
    "quantityKg" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "quantityUnit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "supplyQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoffeeSpecies" (
    "id" TEXT NOT NULL,

    CONSTRAINT "CoffeeSpecies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_ledger" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "packagingId" TEXT,
    "supplyItemId" TEXT,
    "entryType" "LedgerEntryType" NOT NULL,
    "refType" "LedgerRefType" NOT NULL,
    "refId" TEXT NOT NULL,
    "quantityKg" DECIMAL(10,3),
    "quantityUnit" INTEGER,
    "supplyQuantity" DECIMAL(12,3),
    "incomingPrice" DECIMAL(12,2),
    "reversalOfLedgerId" TEXT,
    "lotNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "lotId" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "inventory_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sample_usages" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "operationKey" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "packCount" INTEGER NOT NULL,
    "totalGrams" DECIMAL(12,3) NOT NULL,
    "totalCost" DECIMAL(14,2) NOT NULL,
    "recipient" TEXT,
    "notes" TEXT,
    "givenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "TransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "voidReason" TEXT,
    "voidAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "sample_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sample_usage_components" (
    "id" TEXT NOT NULL,
    "sampleUsageId" TEXT NOT NULL,
    "productId" TEXT,
    "packagingId" TEXT,
    "label" TEXT NOT NULL,
    "quantityKg" DECIMAL(10,3),
    "quantityUnit" INTEGER,
    "ratioPercent" DECIMAL(5,2),
    "unitCost" DECIMAL(14,4) NOT NULL,
    "totalCost" DECIMAL(14,2) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "sample_usage_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "description" TEXT,
    "voidReason" TEXT,
    "voidAt" TIMESTAMP(3),
    "operationKey" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capital_transactions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "CapitalTransactionType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "description" TEXT,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operationKey" TEXT,

    CONSTRAINT "capital_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB NOT NULL,
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_deliveries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "reminderDate" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_runs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "jobName" TEXT NOT NULL,
    "runKey" TEXT NOT NULL,
    "status" "JobRunStatus" NOT NULL DEFAULT 'RUNNING',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "summary" JSONB,
    "error" TEXT,
    "claimToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_brief_snapshots" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reportDate" DATE NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_brief_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_buckets" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "POStatus" NOT NULL DEFAULT 'DRAFT',
    "supplierId" TEXT NOT NULL,
    "expectedDate" TIMESTAMP(3),
    "notes" TEXT,
    "estimatedShippingCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalEstimate" DECIMAL(12,2),
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT,
    "packagingId" TEXT,
    "supplyItemId" TEXT,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "supplyQuantity" DECIMAL(12,3),
    "reorderPoint" DECIMAL(10,3),
    "currentStock" DECIMAL(10,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artisan_pairing_codes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artisan_pairing_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_device_authorizations" (
    "id" TEXT NOT NULL,
    "deviceCodeHash" TEXT NOT NULL,
    "verificationCodeHash" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "computerName" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "appVersion" TEXT NOT NULL,
    "status" "StudioDeviceAuthorizationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT,
    "machineId" TEXT,
    "approvedByUserId" TEXT,

    CONSTRAINT "studio_device_authorizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roastd_studios" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "computerName" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "appVersion" TEXT NOT NULL,
    "credentialHash" TEXT NOT NULL,
    "status" "StudioStatus" NOT NULL DEFAULT 'OFFLINE',
    "lastSeenAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "authorizedByUserId" TEXT,

    CONSTRAINT "roastd_studios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artisan_roast_imports" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "connectorId" TEXT,
    "originalFilename" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" "ArtisanImportStatus" NOT NULL DEFAULT 'UPLOADED',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "roastId" TEXT,
    "fileModifiedAt" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedAt" TIMESTAMP(3),

    CONSTRAINT "artisan_roast_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roasts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "importId" TEXT,
    "title" TEXT,
    "roastDate" TIMESTAMP(3),
    "sourceVersion" TEXT,
    "chargeTime" INTEGER,
    "dropTime" INTEGER,
    "duration" INTEGER,
    "chargeTemperature" DOUBLE PRECISION,
    "dropTemperature" DOUBLE PRECISION,
    "dryEndTime" INTEGER,
    "firstCrackStartTime" INTEGER,
    "firstCrackEndTime" INTEGER,
    "secondCrackStartTime" INTEGER,
    "secondCrackEndTime" INTEGER,
    "greenWeightGrams" DOUBLE PRECISION,
    "roastedWeightGrams" DOUBLE PRECISION,
    "lossPercent" DOUBLE PRECISION,
    "metadata" JSONB,
    "beanTemperatureSeries" JSONB NOT NULL,
    "environmentalTemperatureSeries" JSONB NOT NULL,
    "events" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_sessions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "status" "LiveSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdateAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentBT" DOUBLE PRECISION,
    "currentET" DOUBLE PRECISION,
    "events" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "live_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "refType" "JournalRefType",
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_lines" (
    "id" TEXT NOT NULL,
    "sideId" INTEGER NOT NULL DEFAULT 0,
    "debit" DECIMAL(16,2) NOT NULL,
    "credit" DECIMAL(16,2) NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "terms" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_prices" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "tierName" TEXT NOT NULL,
    "minOrderQty" DECIMAL(12,2) NOT NULL,
    "pricePerKg" DECIMAL(14,2),
    "pricePerUnit" DECIMAL(14,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "contract_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cupping_sessions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "batchId" TEXT,
    "productId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "evaluatorName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cupping_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cupping_scores" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "category" "CuppingCategory" NOT NULL,
    "score" DECIMAL(4,2) NOT NULL,
    "maxScore" DECIMAL(4,2) NOT NULL DEFAULT 10,
    "notes" TEXT,

    CONSTRAINT "cupping_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "zone" TEXT,
    "capacity" DECIMAL(12,3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "systemPurpose" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lot_placements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantityKg" DECIMAL(12,3) NOT NULL,
    "quantityUnit" INTEGER NOT NULL DEFAULT 0,
    "supplyQty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lot_placements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_transfers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "sourceLocationId" TEXT NOT NULL,
    "destinationLocationId" TEXT NOT NULL,
    "quantityKg" DECIMAL(12,3),
    "quantityUnit" INTEGER,
    "supplyQty" DECIMAL(12,3),
    "notes" TEXT,
    "status" "LocationTransferStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "voidAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "location_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_opnames" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "systemQuantityKg" DECIMAL(12,3),
    "systemQuantityUnit" INTEGER,
    "systemSupplyQty" DECIMAL(12,3),
    "countedQuantityKg" DECIMAL(12,3),
    "countedQuantityUnit" INTEGER,
    "countedSupplyQty" DECIMAL(12,3),
    "notes" TEXT,
    "status" "LocationOpnameStatus" NOT NULL DEFAULT 'DRAFT',
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "location_opnames_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_code_key" ON "tenants"("code");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_subdomain_key" ON "tenants"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_artisanWebhookToken_key" ON "tenants"("artisanWebhookToken");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_artisanWebhookTokenHash_key" ON "tenants"("artisanWebhookTokenHash");

-- CreateIndex
CREATE INDEX "portal_themes_tenantId_idx" ON "portal_themes"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "portal_themes_tenantId_key" ON "portal_themes"("tenantId");

-- CreateIndex
CREATE INDEX "tenant_roast_levels_tenantId_isActive_idx" ON "tenant_roast_levels"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_roast_levels_tenantId_label_key" ON "tenant_roast_levels"("tenantId", "label");

-- CreateIndex
CREATE INDEX "machines_tenantId_isActive_idx" ON "machines"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "machines_tenantId_name_key" ON "machines"("tenantId", "name");

-- CreateIndex
CREATE INDEX "roast_profiles_tenantId_isActive_idx" ON "roast_profiles"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_payments_midtransOrderId_key" ON "subscription_payments"("midtransOrderId");

-- CreateIndex
CREATE INDEX "subscription_payments_tenantId_idx" ON "subscription_payments"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_expiresAt_idx" ON "password_reset_tokens"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expiresAt_idx" ON "password_reset_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "customers_tenantId_isActive_idx" ON "customers"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "customers_tenantId_code_key" ON "customers"("tenantId", "code");

-- CreateIndex
CREATE INDEX "suppliers_tenantId_isActive_idx" ON "suppliers"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_tenantId_code_key" ON "suppliers"("tenantId", "code");

-- CreateIndex
CREATE INDEX "coffee_sources_tenantId_isActive_idx" ON "coffee_sources"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "coffee_sources_tenantId_code_key" ON "coffee_sources"("tenantId", "code");

-- CreateIndex
CREATE INDEX "coffee_offerings_tenantId_isActive_sortOrder_idx" ON "coffee_offerings"("tenantId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "coffee_offerings_tenantId_coffeeSourceId_idx" ON "coffee_offerings"("tenantId", "coffeeSourceId");

-- CreateIndex
CREATE INDEX "coffee_offerings_tenantId_lineageProductId_idx" ON "coffee_offerings"("tenantId", "lineageProductId");

-- CreateIndex
CREATE UNIQUE INDEX "coffee_offerings_tenantId_code_key" ON "coffee_offerings"("tenantId", "code");

-- CreateIndex
CREATE INDEX "offering_variants_tenantId_offeringId_isActive_idx" ON "offering_variants"("tenantId", "offeringId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "offering_variants_offeringId_supplyItemId_key" ON "offering_variants"("offeringId", "supplyItemId");

-- CreateIndex
CREATE INDEX "products_tenantId_type_isActive_idx" ON "products"("tenantId", "type", "isActive");

-- CreateIndex
CREATE INDEX "products_tenantId_sourceGreenBeanId_idx" ON "products"("tenantId", "sourceGreenBeanId");

-- CreateIndex
CREATE INDEX "products_tenantId_coffeeSourceId_idx" ON "products"("tenantId", "coffeeSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "products_tenantId_code_key" ON "products"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "products_tenantId_sourceGreenBeanId_roastLevel_key" ON "products"("tenantId", "sourceGreenBeanId", "roastLevel");

-- CreateIndex
CREATE UNIQUE INDEX "packagings_supplyItemId_key" ON "packagings"("supplyItemId");

-- CreateIndex
CREATE INDEX "packagings_tenantId_isActive_idx" ON "packagings"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "packagings_tenantId_code_key" ON "packagings"("tenantId", "code");

-- CreateIndex
CREATE INDEX "inventory_supply_items_tenantId_category_isActive_idx" ON "inventory_supply_items"("tenantId", "category", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_supply_items_tenantId_code_key" ON "inventory_supply_items"("tenantId", "code");

-- CreateIndex
CREATE INDEX "recipes_tenantId_isActive_idx" ON "recipes"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_tenantId_code_key" ON "recipes"("tenantId", "code");

-- CreateIndex
CREATE INDEX "recipe_items_tenantId_idx" ON "recipe_items"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_items_recipeId_productId_key" ON "recipe_items"("recipeId", "productId");

-- CreateIndex
CREATE INDEX "recipe_supply_items_tenantId_idx" ON "recipe_supply_items"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_supply_items_recipeId_supplyItemId_key" ON "recipe_supply_items"("recipeId", "supplyItemId");

-- CreateIndex
CREATE INDEX "purchases_tenantId_receivedAt_idx" ON "purchases"("tenantId", "receivedAt");

-- CreateIndex
CREATE INDEX "purchases_tenantId_status_idx" ON "purchases"("tenantId", "status");

-- CreateIndex
CREATE INDEX "purchases_tenantId_paymentStatus_dueDate_idx" ON "purchases"("tenantId", "paymentStatus", "dueDate");

-- CreateIndex
CREATE INDEX "purchases_tenantId_purchaseOrderId_idx" ON "purchases"("tenantId", "purchaseOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_tenantId_code_key" ON "purchases"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_tenantId_operationKey_key" ON "purchases"("tenantId", "operationKey");

-- CreateIndex
CREATE INDEX "parent_roasting_batches_tenantId_status_createdAt_idx" ON "parent_roasting_batches"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "parent_roasting_batches_referenceRoastId_idx" ON "parent_roasting_batches"("referenceRoastId");

-- CreateIndex
CREATE INDEX "parent_roasting_batches_referenceProfileId_idx" ON "parent_roasting_batches"("referenceProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "parent_roasting_batches_tenantId_code_key" ON "parent_roasting_batches"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "parent_roasting_batches_tenantId_operationKey_key" ON "parent_roasting_batches"("tenantId", "operationKey");

-- CreateIndex
CREATE INDEX "roast_material_reservations_tenantId_status_idx" ON "roast_material_reservations"("tenantId", "status");

-- CreateIndex
CREATE INDEX "roast_material_reservations_tenantId_lotId_status_idx" ON "roast_material_reservations"("tenantId", "lotId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "roast_material_reservations_parentBatchId_lotId_sourceLocat_key" ON "roast_material_reservations"("parentBatchId", "lotId", "sourceLocationId");

-- CreateIndex
CREATE UNIQUE INDEX "child_roasting_batches_artisanEventId_key" ON "child_roasting_batches"("artisanEventId");

-- CreateIndex
CREATE INDEX "child_roasting_batches_tenantId_idx" ON "child_roasting_batches"("tenantId");

-- CreateIndex
CREATE INDEX "production_batches_tenantId_status_producedAt_idx" ON "production_batches"("tenantId", "status", "producedAt");

-- CreateIndex
CREATE UNIQUE INDEX "production_batches_tenantId_code_key" ON "production_batches"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "production_batches_tenantId_operationKey_key" ON "production_batches"("tenantId", "operationKey");

-- CreateIndex
CREATE INDEX "grinding_batches_tenantId_createdAt_idx" ON "grinding_batches"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "grinding_batches_tenantId_code_key" ON "grinding_batches"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "grinding_batches_tenantId_operationKey_key" ON "grinding_batches"("tenantId", "operationKey");

-- CreateIndex
CREATE INDEX "experimental_productions_tenantId_createdAt_idx" ON "experimental_productions"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "experimental_productions_tenantId_code_key" ON "experimental_productions"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "experimental_productions_tenantId_operationKey_key" ON "experimental_productions"("tenantId", "operationKey");

-- CreateIndex
CREATE INDEX "experimental_production_components_tenantId_idx" ON "experimental_production_components"("tenantId");

-- CreateIndex
CREATE INDEX "experimental_production_components_experimentalProductionId_idx" ON "experimental_production_components"("experimentalProductionId");

-- CreateIndex
CREATE INDEX "production_supply_usages_tenantId_idx" ON "production_supply_usages"("tenantId");

-- CreateIndex
CREATE INDEX "production_supply_usages_supplyItemId_idx" ON "production_supply_usages"("supplyItemId");

-- CreateIndex
CREATE UNIQUE INDEX "production_supply_usages_productionBatchId_supplyItemId_key" ON "production_supply_usages"("productionBatchId", "supplyItemId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_publicOrderToken_key" ON "invoices"("publicOrderToken");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_midtransOrderId_key" ON "invoices"("midtransOrderId");

-- CreateIndex
CREATE INDEX "invoices_tenantId_status_issuedAt_idx" ON "invoices"("tenantId", "status", "issuedAt");

-- CreateIndex
CREATE INDEX "invoices_tenantId_customerId_issuedAt_idx" ON "invoices"("tenantId", "customerId", "issuedAt");

-- CreateIndex
CREATE INDEX "invoices_tenantId_fulfillmentStatus_issuedAt_idx" ON "invoices"("tenantId", "fulfillmentStatus", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_tenantId_code_key" ON "invoices"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_tenantId_operationKey_key" ON "invoices"("tenantId", "operationKey");

-- CreateIndex
CREATE INDEX "stock_reservations_tenantId_status_expiresAt_idx" ON "stock_reservations"("tenantId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "stock_reservations_tenantId_productId_status_idx" ON "stock_reservations"("tenantId", "productId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "stock_reservations_invoiceId_productId_key" ON "stock_reservations"("invoiceId", "productId");

-- CreateIndex
CREATE INDEX "fulfillment_tasks_tenantId_status_createdAt_idx" ON "fulfillment_tasks"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "fulfillment_tasks_tenantId_productId_status_idx" ON "fulfillment_tasks"("tenantId", "productId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "fulfillment_tasks_invoiceId_productId_key" ON "fulfillment_tasks"("invoiceId", "productId");

-- CreateIndex
CREATE INDEX "invoice_items_tenantId_idx" ON "invoice_items"("tenantId");

-- CreateIndex
CREATE INDEX "invoice_items_invoiceId_idx" ON "invoice_items"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_items_contractPriceId_idx" ON "invoice_items"("contractPriceId");

-- CreateIndex
CREATE INDEX "invoice_items_offeringId_idx" ON "invoice_items"("offeringId");

-- CreateIndex
CREATE INDEX "invoice_items_offeringVariantId_idx" ON "invoice_items"("offeringVariantId");

-- CreateIndex
CREATE INDEX "payments_tenantId_paidAt_idx" ON "payments"("tenantId", "paidAt");

-- CreateIndex
CREATE INDEX "payments_tenantId_invoiceId_idx" ON "payments"("tenantId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_tenantId_code_key" ON "payments"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "payments_tenantId_operationKey_key" ON "payments"("tenantId", "operationKey");

-- CreateIndex
CREATE INDEX "tenant_payment_methods_tenantId_isActive_displayOrder_idx" ON "tenant_payment_methods"("tenantId", "isActive", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "payment_submissions_paymentId_key" ON "payment_submissions"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_submissions_publicToken_key" ON "payment_submissions"("publicToken");

-- CreateIndex
CREATE INDEX "payment_submissions_tenantId_status_submittedAt_idx" ON "payment_submissions"("tenantId", "status", "submittedAt");

-- CreateIndex
CREATE INDEX "payment_submissions_tenantId_invoiceId_idx" ON "payment_submissions"("tenantId", "invoiceId");

-- CreateIndex
CREATE INDEX "payment_submissions_tenantId_reference_submittedAt_idx" ON "payment_submissions"("tenantId", "reference", "submittedAt");

-- CreateIndex
CREATE INDEX "payment_submissions_tenantId_proofSha256_submittedAt_idx" ON "payment_submissions"("tenantId", "proofSha256", "submittedAt");

-- CreateIndex
CREATE INDEX "payment_submissions_status_expiresAt_idx" ON "payment_submissions"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "payment_notification_deliveries_tenantId_status_createdAt_idx" ON "payment_notification_deliveries"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "payment_notification_deliveries_paymentSubmissionId_idx" ON "payment_notification_deliveries"("paymentSubmissionId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_notification_deliveries_paymentSubmissionId_event_c_key" ON "payment_notification_deliveries"("paymentSubmissionId", "event", "channel", "recipient", "attempt");

-- CreateIndex
CREATE INDEX "credit_notes_tenantId_invoiceId_idx" ON "credit_notes"("tenantId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_tenantId_code_key" ON "credit_notes"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_tenantId_operationKey_key" ON "credit_notes"("tenantId", "operationKey");

-- CreateIndex
CREATE INDEX "credit_note_items_tenantId_creditNoteId_idx" ON "credit_note_items"("tenantId", "creditNoteId");

-- CreateIndex
CREATE INDEX "supplier_payments_tenantId_paidAt_idx" ON "supplier_payments"("tenantId", "paidAt");

-- CreateIndex
CREATE INDEX "supplier_payments_tenantId_purchaseId_idx" ON "supplier_payments"("tenantId", "purchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_payments_tenantId_code_key" ON "supplier_payments"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_payments_tenantId_operationKey_key" ON "supplier_payments"("tenantId", "operationKey");

-- CreateIndex
CREATE INDEX "onboarding_snapshots_tenantId_idx" ON "onboarding_snapshots"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_snapshots_tenantId_step_key" ON "onboarding_snapshots"("tenantId", "step");

-- CreateIndex
CREATE INDEX "lots_tenantId_idx" ON "lots"("tenantId");

-- CreateIndex
CREATE INDEX "lots_productId_idx" ON "lots"("tenantId", "productId");

-- CreateIndex
CREATE INDEX "lots_packagingId_idx" ON "lots"("tenantId", "packagingId");

-- CreateIndex
CREATE INDEX "lots_supplierId_idx" ON "lots"("tenantId", "supplierId");

-- CreateIndex
CREATE INDEX "lots_purchaseId_idx" ON "lots"("tenantId", "purchaseId");

-- CreateIndex
CREATE INDEX "lots_expiryDate_idx" ON "lots"("tenantId", "expiryDate");

-- CreateIndex
CREATE INDEX "lots_supplyItemId_idx" ON "lots"("tenantId", "supplyItemId");

-- CreateIndex
CREATE UNIQUE INDEX "lots_tenantId_batchCode_unique" ON "lots"("tenantId", "batchCode");

-- CreateIndex
CREATE INDEX "inventory_ledger_tenantId_productId_createdAt_idx" ON "inventory_ledger"("tenantId", "productId", "createdAt");

-- CreateIndex
CREATE INDEX "inventory_ledger_tenantId_packagingId_createdAt_idx" ON "inventory_ledger"("tenantId", "packagingId", "createdAt");

-- CreateIndex
CREATE INDEX "inventory_ledger_tenantId_supplyItemId_createdAt_idx" ON "inventory_ledger"("tenantId", "supplyItemId", "createdAt");

-- CreateIndex
CREATE INDEX "inventory_ledger_lotId_idx" ON "inventory_ledger"("lotId");

-- CreateIndex
CREATE INDEX "inventory_ledger_tenantId_refType_refId_idx" ON "inventory_ledger"("tenantId", "refType", "refId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_ledger_tenantId_reversalOfLedgerId_key" ON "inventory_ledger"("tenantId", "reversalOfLedgerId");

-- CreateIndex
CREATE INDEX "sample_usages_tenantId_givenAt_status_idx" ON "sample_usages"("tenantId", "givenAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sample_usages_tenantId_code_key" ON "sample_usages"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "sample_usages_tenantId_operationKey_key" ON "sample_usages"("tenantId", "operationKey");

-- CreateIndex
CREATE INDEX "sample_usage_components_tenantId_sampleUsageId_idx" ON "sample_usage_components"("tenantId", "sampleUsageId");

-- CreateIndex
CREATE INDEX "sample_usage_components_tenantId_productId_idx" ON "sample_usage_components"("tenantId", "productId");

-- CreateIndex
CREATE INDEX "sample_usage_components_tenantId_packagingId_idx" ON "sample_usage_components"("tenantId", "packagingId");

-- CreateIndex
CREATE INDEX "notification_preferences_tenantId_enabled_idx" ON "notification_preferences"("tenantId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_tenantId_channel_event_key" ON "notification_preferences"("tenantId", "channel", "event");

-- CreateIndex
CREATE INDEX "expenses_tenantId_date_idx" ON "expenses"("tenantId", "date");

-- CreateIndex
CREATE INDEX "expenses_tenantId_category_idx" ON "expenses"("tenantId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_tenantId_operationKey_key" ON "expenses"("tenantId", "operationKey");

-- CreateIndex
CREATE INDEX "capital_transactions_tenantId_transactionDate_idx" ON "capital_transactions"("tenantId", "transactionDate");

-- CreateIndex
CREATE INDEX "capital_transactions_tenantId_type_idx" ON "capital_transactions"("tenantId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "capital_transactions_tenantId_operationKey_key" ON "capital_transactions"("tenantId", "operationKey");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_createdAt_idx" ON "audit_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_entityType_entityId_idx" ON "audit_logs"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "webhook_events_tenantId_provider_receivedAt_idx" ON "webhook_events"("tenantId", "provider", "receivedAt");

-- CreateIndex
CREATE INDEX "webhook_events_status_receivedAt_idx" ON "webhook_events"("status", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_tenantId_provider_eventId_key" ON "webhook_events"("tenantId", "provider", "eventId");

-- CreateIndex
CREATE INDEX "reminder_deliveries_tenantId_reminderDate_status_idx" ON "reminder_deliveries"("tenantId", "reminderDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_deliveries_tenantId_invoiceId_channel_reminderDate_key" ON "reminder_deliveries"("tenantId", "invoiceId", "channel", "reminderDate");

-- CreateIndex
CREATE UNIQUE INDEX "job_runs_runKey_key" ON "job_runs"("runKey");

-- CreateIndex
CREATE INDEX "job_runs_jobName_startedAt_idx" ON "job_runs"("jobName", "startedAt");

-- CreateIndex
CREATE INDEX "job_runs_status_startedAt_idx" ON "job_runs"("status", "startedAt");

-- CreateIndex
CREATE INDEX "job_runs_tenantId_startedAt_idx" ON "job_runs"("tenantId", "startedAt");

-- CreateIndex
CREATE INDEX "daily_brief_snapshots_tenantId_generatedAt_idx" ON "daily_brief_snapshots"("tenantId", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "daily_brief_snapshots_tenantId_reportDate_key" ON "daily_brief_snapshots"("tenantId", "reportDate");

-- CreateIndex
CREATE INDEX "rate_limit_buckets_expiresAt_idx" ON "rate_limit_buckets"("expiresAt");

-- CreateIndex
CREATE INDEX "purchase_orders_tenantId_status_idx" ON "purchase_orders"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_tenantId_code_key" ON "purchase_orders"("tenantId", "code");

-- CreateIndex
CREATE INDEX "purchase_order_items_tenantId_purchaseOrderId_idx" ON "purchase_order_items"("tenantId", "purchaseOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "artisan_pairing_codes_codeHash_key" ON "artisan_pairing_codes"("codeHash");

-- CreateIndex
CREATE INDEX "artisan_pairing_codes_tenantId_idx" ON "artisan_pairing_codes"("tenantId");

-- CreateIndex
CREATE INDEX "artisan_pairing_codes_codeHash_idx" ON "artisan_pairing_codes"("codeHash");

-- CreateIndex
CREATE INDEX "artisan_pairing_codes_expiresAt_idx" ON "artisan_pairing_codes"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "studio_device_authorizations_deviceCodeHash_key" ON "studio_device_authorizations"("deviceCodeHash");

-- CreateIndex
CREATE UNIQUE INDEX "studio_device_authorizations_verificationCodeHash_key" ON "studio_device_authorizations"("verificationCodeHash");

-- CreateIndex
CREATE INDEX "studio_device_authorizations_deviceCodeHash_idx" ON "studio_device_authorizations"("deviceCodeHash");

-- CreateIndex
CREATE INDEX "studio_device_authorizations_verificationCodeHash_idx" ON "studio_device_authorizations"("verificationCodeHash");

-- CreateIndex
CREATE INDEX "studio_device_authorizations_status_expiresAt_idx" ON "studio_device_authorizations"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "studio_device_authorizations_tenantId_idx" ON "studio_device_authorizations"("tenantId");

-- CreateIndex
CREATE INDEX "studio_device_authorizations_machineId_idx" ON "studio_device_authorizations"("machineId");

-- CreateIndex
CREATE UNIQUE INDEX "roastd_studios_installationId_key" ON "roastd_studios"("installationId");

-- CreateIndex
CREATE UNIQUE INDEX "roastd_studios_credentialHash_key" ON "roastd_studios"("credentialHash");

-- CreateIndex
CREATE INDEX "roastd_studios_tenantId_idx" ON "roastd_studios"("tenantId");

-- CreateIndex
CREATE INDEX "roastd_studios_machineId_idx" ON "roastd_studios"("machineId");

-- CreateIndex
CREATE INDEX "roastd_studios_credentialHash_idx" ON "roastd_studios"("credentialHash");

-- CreateIndex
CREATE INDEX "roastd_studios_lastSeenAt_idx" ON "roastd_studios"("lastSeenAt");

-- CreateIndex
CREATE INDEX "roastd_studios_status_idx" ON "roastd_studios"("status");

-- CreateIndex
CREATE INDEX "roastd_studios_authorizedByUserId_idx" ON "roastd_studios"("authorizedByUserId");

-- CreateIndex
CREATE INDEX "artisan_roast_imports_tenantId_uploadedAt_idx" ON "artisan_roast_imports"("tenantId", "uploadedAt");

-- CreateIndex
CREATE INDEX "artisan_roast_imports_tenantId_status_uploadedAt_idx" ON "artisan_roast_imports"("tenantId", "status", "uploadedAt");

-- CreateIndex
CREATE INDEX "artisan_roast_imports_machineId_idx" ON "artisan_roast_imports"("machineId");

-- CreateIndex
CREATE INDEX "artisan_roast_imports_connectorId_idx" ON "artisan_roast_imports"("connectorId");

-- CreateIndex
CREATE INDEX "artisan_roast_imports_status_idx" ON "artisan_roast_imports"("status");

-- CreateIndex
CREATE INDEX "artisan_roast_imports_uploadedAt_idx" ON "artisan_roast_imports"("uploadedAt");

-- CreateIndex
CREATE UNIQUE INDEX "artisan_roast_imports_tenantId_machineId_fileHash_key" ON "artisan_roast_imports"("tenantId", "machineId", "fileHash");

-- CreateIndex
CREATE UNIQUE INDEX "roasts_importId_key" ON "roasts"("importId");

-- CreateIndex
CREATE INDEX "roasts_tenantId_roastDate_idx" ON "roasts"("tenantId", "roastDate");

-- CreateIndex
CREATE INDEX "roasts_machineId_idx" ON "roasts"("machineId");

-- CreateIndex
CREATE INDEX "roasts_roastDate_idx" ON "roasts"("roastDate");

-- CreateIndex
CREATE UNIQUE INDEX "live_sessions_sessionId_key" ON "live_sessions"("sessionId");

-- CreateIndex
CREATE INDEX "live_sessions_tenantId_idx" ON "live_sessions"("tenantId");

-- CreateIndex
CREATE INDEX "live_sessions_machineId_idx" ON "live_sessions"("machineId");

-- CreateIndex
CREATE INDEX "live_sessions_sessionId_idx" ON "live_sessions"("sessionId");

-- CreateIndex
CREATE INDEX "accounts_tenantId_type_idx" ON "accounts"("tenantId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_tenantId_code_key" ON "accounts"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_tenantId_name_key" ON "accounts"("tenantId", "name");

-- CreateIndex
CREATE INDEX "journal_entries_tenantId_date_idx" ON "journal_entries"("tenantId", "date");

-- CreateIndex
CREATE INDEX "journal_entries_tenantId_refType_idx" ON "journal_entries"("tenantId", "refType");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_tenantId_code_key" ON "journal_entries"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_tenantId_refType_reference_key" ON "journal_entries"("tenantId", "refType", "reference");

-- CreateIndex
CREATE INDEX "journal_lines_journalEntryId_idx" ON "journal_lines"("journalEntryId");

-- CreateIndex
CREATE INDEX "journal_lines_accountId_idx" ON "journal_lines"("accountId");

-- CreateIndex
CREATE INDEX "budgets_tenantId_periodYear_periodMonth_idx" ON "budgets"("tenantId", "periodYear", "periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_tenantId_periodYear_periodMonth_category_key" ON "budgets"("tenantId", "periodYear", "periodMonth", "category");

-- CreateIndex
CREATE INDEX "contracts_tenantId_idx" ON "contracts"("tenantId");

-- CreateIndex
CREATE INDEX "contracts_customerId_idx" ON "contracts"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_tenantId_customerId_contractNumber_key" ON "contracts"("tenantId", "customerId", "contractNumber");

-- CreateIndex
CREATE INDEX "contract_prices_contractId_idx" ON "contract_prices"("contractId");

-- CreateIndex
CREATE INDEX "contract_prices_productId_idx" ON "contract_prices"("productId");

-- CreateIndex
CREATE INDEX "contract_prices_tenantId_idx" ON "contract_prices"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "contract_prices_tenantId_contractId_productId_tierName_minOrder" ON "contract_prices"("tenantId", "contractId", "productId", "tierName", "minOrderQty");

-- CreateIndex
CREATE INDEX "cupping_sessions_tenantId_idx" ON "cupping_sessions"("tenantId");

-- CreateIndex
CREATE INDEX "cupping_sessions_batchId_idx" ON "cupping_sessions"("batchId");

-- CreateIndex
CREATE INDEX "cupping_sessions_productId_idx" ON "cupping_sessions"("productId");

-- CreateIndex
CREATE INDEX "cupping_sessions_tenantId_date_idx" ON "cupping_sessions"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "cupping_sessions_tenantId_code_key" ON "cupping_sessions"("tenantId", "code");

-- CreateIndex
CREATE INDEX "cupping_scores_sessionId_idx" ON "cupping_scores"("sessionId");

-- CreateIndex
CREATE INDEX "cupping_scores_category_idx" ON "cupping_scores"("category");

-- CreateIndex
CREATE UNIQUE INDEX "cupping_scores_sessionId_category_key" ON "cupping_scores"("sessionId", "category");

-- CreateIndex
CREATE INDEX "warehouses_tenantId_isDefault_idx" ON "warehouses"("tenantId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_tenantId_code_key" ON "warehouses"("tenantId", "code");

-- CreateIndex
CREATE INDEX "locations_tenantId_warehouseId_isDefault_idx" ON "locations"("tenantId", "warehouseId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "locations_tenantId_warehouseId_code_key" ON "locations"("tenantId", "warehouseId", "code");

-- CreateIndex
CREATE INDEX "lot_placements_tenantId_locationId_idx" ON "lot_placements"("tenantId", "locationId");

-- CreateIndex
CREATE INDEX "lot_placements_tenantId_lotId_idx" ON "lot_placements"("tenantId", "lotId");

-- CreateIndex
CREATE UNIQUE INDEX "lot_placements_tenantId_lotId_locationId_key" ON "lot_placements"("tenantId", "lotId", "locationId");

-- CreateIndex
CREATE INDEX "location_transfers_tenantId_status_idx" ON "location_transfers"("tenantId", "status");

-- CreateIndex
CREATE INDEX "location_transfers_tenantId_lotId_idx" ON "location_transfers"("tenantId", "lotId");

-- CreateIndex
CREATE INDEX "location_transfers_tenantId_sourceLocationId_idx" ON "location_transfers"("tenantId", "sourceLocationId");

-- CreateIndex
CREATE INDEX "location_transfers_tenantId_destinationLocationId_idx" ON "location_transfers"("tenantId", "destinationLocationId");

-- CreateIndex
CREATE INDEX "location_opnames_tenantId_status_idx" ON "location_opnames"("tenantId", "status");

-- CreateIndex
CREATE INDEX "location_opnames_tenantId_locationId_idx" ON "location_opnames"("tenantId", "locationId");

-- CreateIndex
CREATE INDEX "location_opnames_tenantId_lotId_idx" ON "location_opnames"("tenantId", "lotId");

-- AddForeignKey
ALTER TABLE "portal_themes" ADD CONSTRAINT "portal_themes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_roast_levels" ADD CONSTRAINT "tenant_roast_levels_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machines" ADD CONSTRAINT "machines_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roast_profiles" ADD CONSTRAINT "roast_profiles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roast_profiles" ADD CONSTRAINT "roast_profiles_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "machines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coffee_sources" ADD CONSTRAINT "coffee_sources_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coffee_offerings" ADD CONSTRAINT "coffee_offerings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coffee_offerings" ADD CONSTRAINT "coffee_offerings_coffeeSourceId_fkey" FOREIGN KEY ("coffeeSourceId") REFERENCES "coffee_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coffee_offerings" ADD CONSTRAINT "coffee_offerings_lineageProductId_fkey" FOREIGN KEY ("lineageProductId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offering_variants" ADD CONSTRAINT "offering_variants_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offering_variants" ADD CONSTRAINT "offering_variants_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "coffee_offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offering_variants" ADD CONSTRAINT "offering_variants_supplyItemId_fkey" FOREIGN KEY ("supplyItemId") REFERENCES "inventory_supply_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_sourceGreenBeanId_fkey" FOREIGN KEY ("sourceGreenBeanId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_coffeeSourceId_fkey" FOREIGN KEY ("coffeeSourceId") REFERENCES "coffee_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packagings" ADD CONSTRAINT "packagings_supplyItemId_fkey" FOREIGN KEY ("supplyItemId") REFERENCES "inventory_supply_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packagings" ADD CONSTRAINT "packagings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_supply_items" ADD CONSTRAINT "inventory_supply_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_packagingId_fkey" FOREIGN KEY ("packagingId") REFERENCES "packagings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_supply_items" ADD CONSTRAINT "recipe_supply_items_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_supply_items" ADD CONSTRAINT "recipe_supply_items_supplyItemId_fkey" FOREIGN KEY ("supplyItemId") REFERENCES "inventory_supply_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_supply_items" ADD CONSTRAINT "recipe_supply_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_packagingId_fkey" FOREIGN KEY ("packagingId") REFERENCES "packagings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplyItemId_fkey" FOREIGN KEY ("supplyItemId") REFERENCES "inventory_supply_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_roasting_batches" ADD CONSTRAINT "parent_roasting_batches_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "machines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_roasting_batches" ADD CONSTRAINT "parent_roasting_batches_referenceRoastId_fkey" FOREIGN KEY ("referenceRoastId") REFERENCES "roasts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_roasting_batches" ADD CONSTRAINT "parent_roasting_batches_referenceProfileId_fkey" FOREIGN KEY ("referenceProfileId") REFERENCES "roast_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_roasting_batches" ADD CONSTRAINT "parent_roasting_batches_inputProductId_fkey" FOREIGN KEY ("inputProductId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_roasting_batches" ADD CONSTRAINT "parent_roasting_batches_outputProductId_fkey" FOREIGN KEY ("outputProductId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_roasting_batches" ADD CONSTRAINT "parent_roasting_batches_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_roasting_batches" ADD CONSTRAINT "parent_roasting_batches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roast_material_reservations" ADD CONSTRAINT "roast_material_reservations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roast_material_reservations" ADD CONSTRAINT "roast_material_reservations_parentBatchId_fkey" FOREIGN KEY ("parentBatchId") REFERENCES "parent_roasting_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roast_material_reservations" ADD CONSTRAINT "roast_material_reservations_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roast_material_reservations" ADD CONSTRAINT "roast_material_reservations_sourceLocationId_fkey" FOREIGN KEY ("sourceLocationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_roasting_batches" ADD CONSTRAINT "child_roasting_batches_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "parent_roasting_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_roasting_batches" ADD CONSTRAINT "child_roasting_batches_roastId_fkey" FOREIGN KEY ("roastId") REFERENCES "roasts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_roasting_batches" ADD CONSTRAINT "child_roasting_batches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_outputProductId_fkey" FOREIGN KEY ("outputProductId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_packagingId_fkey" FOREIGN KEY ("packagingId") REFERENCES "packagings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_parentRoastBatchId_fkey" FOREIGN KEY ("parentRoastBatchId") REFERENCES "parent_roasting_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_batches" ADD CONSTRAINT "production_batches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grinding_batches" ADD CONSTRAINT "grinding_batches_sourceProductId_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grinding_batches" ADD CONSTRAINT "grinding_batches_outputProductId_fkey" FOREIGN KEY ("outputProductId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grinding_batches" ADD CONSTRAINT "grinding_batches_parentRoastBatchId_fkey" FOREIGN KEY ("parentRoastBatchId") REFERENCES "parent_roasting_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grinding_batches" ADD CONSTRAINT "grinding_batches_grinderId_fkey" FOREIGN KEY ("grinderId") REFERENCES "machines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grinding_batches" ADD CONSTRAINT "grinding_batches_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grinding_batches" ADD CONSTRAINT "grinding_batches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experimental_productions" ADD CONSTRAINT "experimental_productions_outputProductId_fkey" FOREIGN KEY ("outputProductId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experimental_productions" ADD CONSTRAINT "experimental_productions_parentRoastBatchId_fkey" FOREIGN KEY ("parentRoastBatchId") REFERENCES "parent_roasting_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experimental_productions" ADD CONSTRAINT "experimental_productions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experimental_productions" ADD CONSTRAINT "experimental_productions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experimental_production_components" ADD CONSTRAINT "experimental_production_components_experimentalProductionI_fkey" FOREIGN KEY ("experimentalProductionId") REFERENCES "experimental_productions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experimental_production_components" ADD CONSTRAINT "experimental_production_components_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experimental_production_components" ADD CONSTRAINT "experimental_production_components_supplyItemId_fkey" FOREIGN KEY ("supplyItemId") REFERENCES "inventory_supply_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experimental_production_components" ADD CONSTRAINT "experimental_production_components_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_supply_usages" ADD CONSTRAINT "production_supply_usages_productionBatchId_fkey" FOREIGN KEY ("productionBatchId") REFERENCES "production_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_supply_usages" ADD CONSTRAINT "production_supply_usages_supplyItemId_fkey" FOREIGN KEY ("supplyItemId") REFERENCES "inventory_supply_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_supply_usages" ADD CONSTRAINT "production_supply_usages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_tasks" ADD CONSTRAINT "fulfillment_tasks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_tasks" ADD CONSTRAINT "fulfillment_tasks_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfillment_tasks" ADD CONSTRAINT "fulfillment_tasks_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_contractPriceId_fkey" FOREIGN KEY ("contractPriceId") REFERENCES "contract_prices"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "coffee_offerings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_payment_methods" ADD CONSTRAINT "tenant_payment_methods_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "tenant_payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_suspectedDuplicateOfId_fkey" FOREIGN KEY ("suspectedDuplicateOfId") REFERENCES "payment_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_notification_deliveries" ADD CONSTRAINT "payment_notification_deliveries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_notification_deliveries" ADD CONSTRAINT "payment_notification_deliveries_paymentSubmissionId_fkey" FOREIGN KEY ("paymentSubmissionId") REFERENCES "payment_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_items" ADD CONSTRAINT "credit_note_items_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "credit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_items" ADD CONSTRAINT "credit_note_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_items" ADD CONSTRAINT "credit_note_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_snapshots" ADD CONSTRAINT "onboarding_snapshots_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_packagingId_fkey" FOREIGN KEY ("packagingId") REFERENCES "packagings"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_supplyItemId_fkey" FOREIGN KEY ("supplyItemId") REFERENCES "inventory_supply_items"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "inventory_ledger" ADD CONSTRAINT "inventory_ledger_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ledger" ADD CONSTRAINT "inventory_ledger_packagingId_fkey" FOREIGN KEY ("packagingId") REFERENCES "packagings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ledger" ADD CONSTRAINT "inventory_ledger_supplyItemId_fkey" FOREIGN KEY ("supplyItemId") REFERENCES "inventory_supply_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ledger" ADD CONSTRAINT "inventory_ledger_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lots"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "inventory_ledger" ADD CONSTRAINT "inventory_ledger_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ledger" ADD CONSTRAINT "inventory_ledger_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_usages" ADD CONSTRAINT "sample_usages_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_usages" ADD CONSTRAINT "sample_usages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_usage_components" ADD CONSTRAINT "sample_usage_components_sampleUsageId_fkey" FOREIGN KEY ("sampleUsageId") REFERENCES "sample_usages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_usage_components" ADD CONSTRAINT "sample_usage_components_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_usage_components" ADD CONSTRAINT "sample_usage_components_packagingId_fkey" FOREIGN KEY ("packagingId") REFERENCES "packagings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_usage_components" ADD CONSTRAINT "sample_usage_components_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capital_transactions" ADD CONSTRAINT "capital_transactions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capital_transactions" ADD CONSTRAINT "capital_transactions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_deliveries" ADD CONSTRAINT "reminder_deliveries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_deliveries" ADD CONSTRAINT "reminder_deliveries_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_brief_snapshots" ADD CONSTRAINT "daily_brief_snapshots_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_packagingId_fkey" FOREIGN KEY ("packagingId") REFERENCES "packagings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_supplyItemId_fkey" FOREIGN KEY ("supplyItemId") REFERENCES "inventory_supply_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artisan_pairing_codes" ADD CONSTRAINT "artisan_pairing_codes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artisan_pairing_codes" ADD CONSTRAINT "artisan_pairing_codes_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_device_authorizations" ADD CONSTRAINT "studio_device_authorizations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_device_authorizations" ADD CONSTRAINT "studio_device_authorizations_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "machines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_device_authorizations" ADD CONSTRAINT "studio_device_authorizations_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roastd_studios" ADD CONSTRAINT "roastd_studios_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roastd_studios" ADD CONSTRAINT "roastd_studios_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roastd_studios" ADD CONSTRAINT "roastd_studios_authorizedByUserId_fkey" FOREIGN KEY ("authorizedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artisan_roast_imports" ADD CONSTRAINT "artisan_roast_imports_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artisan_roast_imports" ADD CONSTRAINT "artisan_roast_imports_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artisan_roast_imports" ADD CONSTRAINT "artisan_roast_imports_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "roastd_studios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roasts" ADD CONSTRAINT "roasts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roasts" ADD CONSTRAINT "roasts_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "machines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_prices" ADD CONSTRAINT "contract_prices_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_prices" ADD CONSTRAINT "contract_prices_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_prices" ADD CONSTRAINT "contract_prices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cupping_sessions" ADD CONSTRAINT "cupping_sessions_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "parent_roasting_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cupping_sessions" ADD CONSTRAINT "cupping_sessions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cupping_sessions" ADD CONSTRAINT "cupping_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cupping_scores" ADD CONSTRAINT "cupping_scores_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "cupping_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_placements" ADD CONSTRAINT "lot_placements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_placements" ADD CONSTRAINT "lot_placements_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_placements" ADD CONSTRAINT "lot_placements_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_transfers" ADD CONSTRAINT "location_transfers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_transfers" ADD CONSTRAINT "location_transfers_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_transfers" ADD CONSTRAINT "location_transfers_sourceLocationId_fkey" FOREIGN KEY ("sourceLocationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_transfers" ADD CONSTRAINT "location_transfers_destinationLocationId_fkey" FOREIGN KEY ("destinationLocationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_transfers" ADD CONSTRAINT "location_transfers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_opnames" ADD CONSTRAINT "location_opnames_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_opnames" ADD CONSTRAINT "location_opnames_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_opnames" ADD CONSTRAINT "location_opnames_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_opnames" ADD CONSTRAINT "location_opnames_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_opnames" ADD CONSTRAINT "location_opnames_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
