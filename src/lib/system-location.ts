// Central invariant for system-managed location records (e.g. SYS-ROASTING-WIP).
// These locations are infrastructure for automated workflows (roast lifecycle,
// future system flows). Normal warehouse operations must never mutate them.

export const SYSTEM_LOCATION_ERROR =
  "Lokasi sistem dikelola otomatis dan tidak dapat diubah.";

export const SYSTEM_LOCATION_CODE_PREFIX = "SYS-";

export const SYSTEM_LOCATION_CODE_ERROR =
  'Kode lokasi dengan awalan "SYS-" dicadangkan untuk lokasi sistem.';

export function isSystemLocation(loc: { isSystem?: boolean | null }): boolean {
  return loc.isSystem === true;
}