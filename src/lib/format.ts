import { format, isValid, parse } from "date-fns";

/**
 * Dates are stored throughout this schema as `dd-MM-yyyy` STRINGS, not as
 * date columns. Showing that raw to a member is how you end up with a card
 * reading "01-01-2000" over "04-09-2026" with nothing to say which is which.
 *
 * Returns undefined for a missing or unparseable value so callers can fall
 * through to their own empty state rather than printing "Invalid Date".
 */
export function formatAppDate(value?: string | null, pattern = "d MMM yyyy"): string | undefined {
  if (!value) return undefined;
  const parsed = parse(value, "dd-MM-yyyy", new Date());
  if (!isValid(parsed)) return undefined;
  return format(parsed, pattern);
}

/**
 * Coerces a date string into the `dd-MM-yyyy` the schema stores.
 *
 * `<input type="date">` submits `yyyy-MM-dd`, and the registration form used
 * one — so every self-registered member had a date of birth in ISO while the
 * rest of the app stored and parsed `dd-MM-yyyy`. Nothing complained until
 * something tried to parse it, and then it threw "Invalid time value".
 *
 * Accepts either shape and returns undefined if it is neither, so a caller can
 * reject the input rather than store an unparseable value.
 */
export function toAppDate(value?: string | null): string | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;

  for (const pattern of ["dd-MM-yyyy", "yyyy-MM-dd"]) {
    const parsed = parse(raw, pattern, new Date());
    if (isValid(parsed)) return format(parsed, "dd-MM-yyyy");
  }
  return undefined;
}

/**
 * Today, as the GYM reckons it — `dd-MM-yyyy` in Asia/Manila.
 *
 * Vercel runs functions in UTC, so `format(new Date(), "dd-MM-yyyy")` on the
 * server is the UTC date. Between midnight and 08:00 Manila that is still
 * YESTERDAY, so a member logging an early-morning workout had it filed under
 * the wrong day — and their streak and adherence counted it there too.
 *
 * The cron already had this rule (`manilaDay` in notifications/daily.ts);
 * the logging path never got it.
 */
export function gymToday(asOf: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(asOf);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}-${get("month")}-${get("year")}`;
}

/** The wall-clock time at the gym, `HH:mm:ss` in Asia/Manila. Same reason as gymToday(). */
export function gymTime(asOf: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(asOf);
}

/** A stored `HH:mm:ss` wall-clock time as "7:15 am". Empty for a missing value. */
export function formatClock(time?: string | null): string {
  const [hour, minute] = String(time ?? "").split(":");
  const h = Number.parseInt(hour, 10);
  if (!Number.isFinite(h) || !minute) return "";
  return `${h % 12 || 12}:${minute} ${h >= 12 ? "pm" : "am"}`;
}

/**
 * The instant a Manila calendar day starts and ends, for filtering real
 * DateTime columns (Payment.paidAt) by a `dd-MM-yyyy` gym day. Manila is UTC+8
 * all year — the Philippines has no daylight saving.
 */
export function gymDayBounds(day: string): { start: Date; end: Date } | undefined {
  const parsed = parse(day, "dd-MM-yyyy", new Date());
  if (!isValid(parsed)) return undefined;
  const start = new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()) - 8 * 3600_000);
  return { start, end: new Date(start.getTime() + 24 * 3600_000) };
}

/** Whole pesos, thousands-separated, no decimals — the app-wide money format. */
export function pesos(n: number): string {
  return `₱${Math.round(n).toLocaleString("en-PH")}`;
}
