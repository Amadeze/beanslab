import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { format } from "date-fns";
import { id } from "date-fns/locale";

const DEFAULT_TIMEZONE = "Asia/Jakarta";

export type ZonedPeriod = {
  start: Date;
  end: Date;
  dateKey: string;
  timezone: string;
};

export function normalizeTimeZone(timezone?: string | null): string {
  if (!timezone) return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    // Invalid timezone - fallback to default
    return DEFAULT_TIMEZONE;
  }
}

/** Returns a tenant-local calendar day as an exclusive UTC instant range. */
export function getZonedDayRange(
  instant: Date,
  timezone?: string | null,
  dayOffset = 0,
): ZonedPeriod {
  const zone = normalizeTimeZone(timezone);
  const local = toZonedTime(instant, zone);
  local.setDate(local.getDate() + dayOffset);
  local.setHours(0, 0, 0, 0);
  const nextLocal = new Date(local);
  nextLocal.setDate(nextLocal.getDate() + 1);

  return {
    start: fromZonedTime(local, zone),
    end: fromZonedTime(nextLocal, zone),
    dateKey: formatInTimeZone(fromZonedTime(local, zone), zone, "yyyy-MM-dd"),
    timezone: zone,
  };
}

/** Returns a tenant-local month as an exclusive UTC instant range. */
export function getZonedMonthRange(
  year: number,
  month: number,
  timezone?: string | null,
): ZonedPeriod {
  const zone = normalizeTimeZone(timezone);
  const localStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const localEnd = new Date(year, month, 1, 0, 0, 0, 0);
  return {
    start: fromZonedTime(localStart, zone),
    end: fromZonedTime(localEnd, zone),
    dateKey: `${year}-${String(month).padStart(2, "0")}`,
    timezone: zone,
  };
}

/**
 * Mendapatkan waktu saat ini sebagai instant absolut.
 * JavaScript Date tidak menyimpan zona waktu; menggeser nilainya ke wall-clock WIB
 * akan menghasilkan timestamp database yang salah. Gunakan helper format/range di
 * bawah saat representasi kalender WIB memang diperlukan.
 */
export function getCurrentDate(): Date {
  return new Date();
}

/**
 * Memformat tanggal ke string lokal Indonesia (WIB).
 * Contoh output: "17 Juli 2026 15:30:00"
 */
export function formatLocal(date: Date, formatStr: string = "d MMMM yyyy HH:mm:ss"): string {
  const zone = normalizeTimeZone();
  const zoned = toZonedTime(date, zone);
  return format(zoned, formatStr, { locale: id });
}

/**
 * Mendapatkan string YYYY-MM-DD hari ini untuk input form atau query database.
 */
export function getTodayString(): string {
  return formatInTimeZone(new Date(), DEFAULT_TIMEZONE, "yyyy-MM-dd");
}

/**
 * Mendapatkan awal hari ini dalam WIB (00:00:00.000) sebagai Date object UTC.
 * Untuk query database, gunakan returned value sebagai `gte` boundary.
 */
export function getStartOfTodayWIB(): Date {
  const localNow = toZonedTime(new Date(), DEFAULT_TIMEZONE);
  localNow.setHours(0, 0, 0, 0);
  return fromZonedTime(localNow, DEFAULT_TIMEZONE);
}

/**
 * Mendapatkan awal hari berikutnya dalam WIB sebagai Date object UTC.
 * Digunakan sebagai `lt` boundary (exclusive) untuk range "hari ini".
 */
export function getStartOfNextDayWIB(): Date {
  const localNow = toZonedTime(new Date(), DEFAULT_TIMEZONE);
  localNow.setDate(localNow.getDate() + 1);
  localNow.setHours(0, 0, 0, 0);
  return fromZonedTime(localNow, DEFAULT_TIMEZONE);
}

/**
 * Mengecek apakah sebuah Date berada dalam range hari ini (WIB).
 * Range: [startOfDay WIB, startOfNextDay WIB)
 */
export function isTodayWIB(date: Date): boolean {
  const start = getStartOfTodayWIB();
  const end = getStartOfNextDayWIB();
  return date >= start && date < end;
}

// =============================================================================
// TIMEZONE-AWARE DATE HELPERS FOR REPORTS
// =============================================================================

/**
 * Convert date string (YYYY-MM-DD) ke UTC range berdasarkan timezone tenant.
 * Digunakan untuk query database yang benar berdasarkan timezone user.
 *
 * Contoh: dateStr="2025-07-26", timezone="Asia/Jakarta"
 * → start = 2025-07-25T17:00:00Z (26 Juli 00:00 WIB)
 * → end   = 2025-07-26T16:59:59.999Z (26 Juli 23:59 WIB)
 */
export function dateToLocalRange(
  dateStr: string,
  timezone?: string | null,
): { start: Date; end: Date; timezone: string } {
  const zone = normalizeTimeZone(timezone);
  const [year, month, day] = dateStr.split("-").map(Number);
  const localStart = new Date(year, month - 1, day, 0, 0, 0, 0);
  const localEnd = new Date(year, month - 1, day, 23, 59, 59, 999);
  return {
    start: fromZonedTime(localStart, zone),
    end: fromZonedTime(localEnd, zone),
    timezone: zone,
  };
}

/**
 * Format tanggal menggunakan timezone tenant untuk chart/label.
 * Contoh: formatChartDate(date, "Asia/Jakarta") → "26 Jul"
 */
export function formatChartDate(date: Date, timezone?: string | null): string {
  const zone = normalizeTimeZone(timezone);
  const zoned = toZonedTime(date, zone);
  return format(zoned, "d MMM", { locale: id });
}

/**
 * Format tanggal lengkap menggunakan timezone tenant.
 * Contoh: formatReportDate(date, "Asia/Jakarta") → "26 Juli 2025"
 */
export function formatReportDate(date: Date, timezone?: string | null): string {
  const zone = normalizeTimeZone(timezone);
  const zoned = toZonedTime(date, zone);
  return format(zoned, "d MMMM yyyy", { locale: id });
}

/**
 * Mendapatkan string YYYY-MM-DD hari ini berdasarkan timezone tenant.
 * Berguna untuk date picker default.
 */
export function getTodayStringForTimezone(timezone?: string | null): string {
  const zone = normalizeTimeZone(timezone);
  return formatInTimeZone(new Date(), zone, "yyyy-MM-dd");
}

/**
 * Mendapatkan string YYYY-MM-DD N hari lalu berdasarkan timezone tenant.
 */
export function getDateStringDaysAgo(days: number, timezone?: string | null): string {
  const zone = normalizeTimeZone(timezone);
  const date = new Date();
  date.setDate(date.getDate() - days);
  return formatInTimeZone(date, zone, "yyyy-MM-dd");
}

/**
 * Tambah N bulan dengan kebijakan bisnis eksplisit: hari dipertahankan,
 * dan saat bulan tujuan lebih pendek (mis. 31 Jan + 1 bulan), tanggal
 * di-clamp ke hari terakhir bulan tujuan (28/29 Feb) — bukan meluber ke
 * bulan berikutnya (3 Mar) yang menggeser siklus tagihan tanpa sengaja.
 * Jam/menit/detik dipertahankan.
 * 
 * @deprecated Use addMonthsPreservingBillingDay with an anchor date instead.
 * Chaining addMonthsClamped causes billing day drift (31 Jan → 28 Feb → 28 Mar).
 */
export function addMonthsClamped(date: Date, months: number): Date {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const time = [
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  ] as const;

  const candidate = new Date(year, month + months, day, ...time);
  if (candidate.getDate() === day) return candidate;

  // Overflow (hari tidak ada di bulan tujuan): ambil hari terakhir bulan
  // tujuan. day=0 pada bulan (month+months+1) = hari terakhir bulan sebelumnya.
  return new Date(year, month + months + 1, 0, ...time);
}

/**
 * Add months to an ANCHOR date (subscription start), preserving the billing day.
 * If the day doesn't exist in the target month, uses the last day of that month.
 * 
 * Use this for billing cycles: addMonthsPreservingBillingDay(anchor, monthsElapsed)
 * instead of chaining addMonthsClamped.
 */
export function addMonthsPreservingBillingDay(
  anchorDate: Date,
  monthsElapsed: number,
): Date {
  const year = anchorDate.getFullYear();
  const month = anchorDate.getMonth();
  const day = anchorDate.getDate();
  const time = [
    anchorDate.getHours(),
    anchorDate.getMinutes(),
    anchorDate.getSeconds(),
    anchorDate.getMilliseconds(),
  ] as const;

  const candidate = new Date(year, month + monthsElapsed, day, ...time);
  if (candidate.getDate() === day) return candidate;

  // Overflow: use last day of target month
  return new Date(year, month + monthsElapsed + 1, 0, ...time);
}
