// Coffee identity mapping helpers.
//
// CoffeeSource adalah akar identitas kopi (green coffee master). Untuk
// determinisme, kode CoffeeSource yang dibuat dari produk Green Bean SELALU
// sama dengan kode produk Green Bean tersebut (1:1). Identitas tidak pernah
// diinferensi dari nama produk — hanya field eksplisit yang dipindahkan.

export type CoffeeIdentityInput = {
  name?: string;
  country?: string | null;
  region?: string | null;
  farm?: string | null;
  species?: string | null;
  varietal?: string | null;
  processMethod?: string | null;
  fermentationMethod?: string | null;
  elevation?: string | null;
  cropYear?: string | null;
  certifications?: string[];
  tastingNotes?: string | null;
};

export type NormalizedCoffeeIdentity = {
  name: string;
  country: string | null;
  region: string | null;
  farm: string | null;
  species: string | null;
  varietal: string | null;
  processMethod: string | null;
  fermentationMethod: string | null;
  elevation: string | null;
  cropYear: string | null;
  certifications: string[];
  tastingNotes: string | null;
};

export const COFFEE_SOURCE_NAME_MAX = 200;
export const COFFEE_SOURCE_FIELD_MAX = 120;

function clean(value: string | null | undefined, max: number): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

export function normalizeCoffeeIdentity(input: CoffeeIdentityInput): NormalizedCoffeeIdentity {
  const name = clean(input.name, COFFEE_SOURCE_NAME_MAX) ?? "";
  const certifications = (input.certifications ?? [])
    .map((value) => clean(value, COFFEE_SOURCE_FIELD_MAX))
    .filter((value): value is string => value !== null)
    .filter((value, index, all) => {
      const lower = value.toLocaleLowerCase("id-ID");
      return all.findIndex((other) => other.toLocaleLowerCase("id-ID") === lower) === index;
    });
  return {
    name,
    country: clean(input.country, COFFEE_SOURCE_FIELD_MAX),
    region: clean(input.region, COFFEE_SOURCE_FIELD_MAX),
    farm: clean(input.farm, COFFEE_SOURCE_FIELD_MAX),
    species: clean(input.species, COFFEE_SOURCE_FIELD_MAX),
    varietal: clean(input.varietal, COFFEE_SOURCE_FIELD_MAX),
    processMethod: clean(input.processMethod, COFFEE_SOURCE_FIELD_MAX),
    fermentationMethod: clean(input.fermentationMethod, COFFEE_SOURCE_FIELD_MAX),
    elevation: clean(input.elevation, COFFEE_SOURCE_FIELD_MAX),
    cropYear: clean(input.cropYear, COFFEE_SOURCE_FIELD_MAX),
    certifications,
    tastingNotes: clean(input.tastingNotes, 1000),
  };
}

export type CoffeeSourceProductView = {
  code: string;
  name: string;
  coffeeSpecies?: string | null;
  origin?: string | null;
};

/**
 * Mapping deterministik dari produk Green Bean ke data CoffeeSource.
 * code = kode produk GB (unik per tenant di kedua tabel), sehingga koneksi
 * 1:1 antara GB product dan identitasnya tetap eksak.
 * Tidak ada inferensi: hanya field eksplisit yang dipindahkan.
 */
export function coffeeSourceCreateDataFromProduct(
  product: CoffeeSourceProductView,
): NormalizedCoffeeIdentity & { code: string } {
  const normalized = normalizeCoffeeIdentity({
    name: product.name,
    species: product.coffeeSpecies,
    region: product.origin,
  });
  return { ...normalized, code: product.code };
}

export const MATERIAL_ORIGIN_LABEL: Record<string, string> = {
  INTERNAL_ROAST: "Sangrai internal",
  PURCHASED_ROASTED: "Beli jadi (purchased roasted)",
};
