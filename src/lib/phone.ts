/**
 * Philippine mobile numbers, normalised for a BigInt column.
 *
 * The same subscriber writes their number three ways — `0917 123 4567`,
 * `+63 917 123 4567`, `9171234567` — and `Member.phone` is a BigInt, which has
 * no concept of a leading zero. Converting the first form directly with
 * `BigInt()` silently drops that zero and stores a nine-digit number that can
 * never be dialled. This happened to a real registration: a member typed
 * `0988841262`, passed a `\d{10,15}` check, and was stored as `988841262`.
 *
 * Every path that turns typed input into `Member.phone` or `Enquiry.phone`
 * must go through here first.
 */

/** Canonical form: ten digits beginning with 9, e.g. `9171234567`. */
export function normalizePhMobile(raw: string | null | undefined): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return null;

  let n = digits;
  if (n.startsWith("63")) n = n.slice(2); // +63 / 63 country code
  n = n.replace(/^0+/, ""); // local trunk prefix

  // A PH mobile is always 9 followed by nine more digits once the prefix is
  // gone. Anything else is a typo, and is rejected rather than truncated.
  return /^9\d{9}$/.test(n) ? n : null;
}

/** Display form: `0917 123 4567`, the way it is written on a phone. */
export function formatPhMobile(value: bigint | number | string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const n = normalizePhMobile(String(value));
  if (!n) return String(value); // never hide a value we failed to parse
  return `0${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
}
