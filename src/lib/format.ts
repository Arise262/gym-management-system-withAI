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

/** Whole pesos, thousands-separated, no decimals — the app-wide money format. */
export function pesos(n: number): string {
  return `₱${Math.round(n).toLocaleString("en-PH")}`;
}
