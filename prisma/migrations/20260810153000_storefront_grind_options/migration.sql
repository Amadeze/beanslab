ALTER TABLE "recipes"
ADD COLUMN "storefrontGrindOptions" "GrindSize"[] NOT NULL
DEFAULT ARRAY['WHOLE_BEAN']::"GrindSize"[];

ALTER TABLE "invoice_items"
ADD COLUMN "grindSize" "GrindSize",
ADD COLUMN "customGrindLabel" TEXT;
