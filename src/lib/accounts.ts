import bcrypt from "bcryptjs";
import { BCRYPT_ROUNDS } from "@/lib/auth";

/** Domain used for members who have no real email on file. */
export const PLACEHOLDER_EMAIL_DOMAIN = "members.synergyfitness.local";

/**
 * Login email for a member with no recorded address.
 *
 * Members are a walk-in business — plenty of them never give an email. They
 * still need a unique, predictable login, so their member code becomes one.
 * Staff can tell them "sign in as gym0042@members.synergyfitness.local".
 */
export function placeholderEmail(memberCode: string): string {
  return `${memberCode.toLowerCase()}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

/** Resolves the login email for a member: their own, or the generated fallback. */
export function loginEmailFor(
  memberCode: string,
  email?: string | null
): string {
  const trimmed = email?.trim();
  return (trimmed ? trimmed : placeholderEmail(memberCode)).toLowerCase();
}

/**
 * Temporary password issued to staff-created accounts.
 * The member is expected to change it on first login.
 */
export const DEFAULT_TEMP_PASSWORD =
  process.env.SEED_MEMBER_TEMP_PASSWORD ?? "Welcome@12345";

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}
