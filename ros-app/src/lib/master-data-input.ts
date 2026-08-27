import { z } from "zod";

const optionalShortText = z.string().trim().max(120, "Maksimal 120 karakter").optional();
const optionalLongText = z.string().trim().max(500, "Maksimal 500 karakter").optional();

export const customerInputSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(120, "Nama terlalu panjang"),
  phone: z.string().trim().max(30, "Nomor telepon terlalu panjang").optional(),
  email: z
    .string()
    .trim()
    .max(254, "Email terlalu panjang")
    .refine((value) => !value || z.string().email().safeParse(value).success, "Format email tidak valid")
    .optional(),
  address: optionalLongText,
  tier: z.enum(["RETAIL", "WHOLESALE_SILVER", "WHOLESALE_GOLD"]),
  isActive: z.boolean(),
});

export const supplierInputSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(120, "Nama terlalu panjang"),
  phone: z.string().trim().max(30, "Nomor telepon terlalu panjang").optional(),
  region: optionalShortText,
  address: optionalLongText,
  isActive: z.boolean(),
});

export type CustomerInput = z.input<typeof customerInputSchema>;
export type SupplierInput = z.input<typeof supplierInputSchema>;

export function emptyToNull(value?: string | null): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

export function normalizeEmail(value?: string | null): string | null {
  return emptyToNull(value)?.toLowerCase() ?? null;
}

/**
 * Store Indonesian mobile numbers in a predictable local form while preserving
 * non-Indonesian international numbers. This makes search and duplicate checks
 * reliable without forcing users to type a particular format.
 */
export function normalizePhone(value?: string | null): string | null {
  const cleaned = emptyToNull(value)?.replace(/[^\d+]/g, "");
  if (!cleaned) return null;

  if (/^\+?628/.test(cleaned)) return `0${cleaned.replace(/^\+?62/, "")}`;
  if (/^8\d{7,}$/.test(cleaned)) return `0${cleaned}`;
  return cleaned;
}

export function sameNormalizedPhone(left?: string | null, right?: string | null): boolean {
  const normalizedLeft = normalizePhone(left);
  return Boolean(normalizedLeft && normalizedLeft === normalizePhone(right));
}
