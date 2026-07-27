/** Common IANA zones shown in Account timezone picker. */
export const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Australia/Sydney",
  "Asia/Tokyo",
  "America/Tegucigalpa",
] as const;

/** Return true if `timezone` is a valid IANA zone for Intl. */
export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/** Browser-reported IANA zone, or null if unavailable / invalid. */
export function detectBrowserTimezone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && isValidTimezone(tz) ? tz : null;
  } catch {
    return null;
  }
}

/** Options for a select: common list plus current value if missing. */
export function timezoneSelectOptions(current: string): string[] {
  const set = new Set<string>(COMMON_TIMEZONES);
  if (current) set.add(current);
  return [...set].sort((a, b) => a.localeCompare(b));
}
