import type { WalkInRate } from "@prisma/client";

/**
 * CBG's walk-in prices, in whole pesos.
 *
 * Kept in code rather than as Services rows: a Service is sold to a member
 * through the new-sale form, and a walk-in has no member record to sell to.
 * (The 7-day session also exists as a Service for MEMBERS, at the same price.)
 *
 * Changing a price here only affects walk-ins recorded afterwards — each
 * WalkIn row stores the amount it was actually charged.
 */
export const WALK_IN_RATES: Record<WalkInRate, { label: string; price: number }> = {
  STUDENT: { label: "Student", price: 50 },
  REGULAR: { label: "Non-student", price: 60 },
  WEEKLY: { label: "Weekly pass", price: 280 },
};

/** How many days a weekly pass covers, counting the day it is bought. */
export const WEEKLY_PASS_DAYS = 7;

export const WALK_IN_RATE_KEYS = Object.keys(WALK_IN_RATES) as WalkInRate[];

export function isWalkInRate(value: unknown): value is WalkInRate {
  // Not `value in WALK_IN_RATES` — that is true for "toString" too.
  return typeof value === "string" && (WALK_IN_RATE_KEYS as string[]).includes(value);
}

/** Names are matched to passes case-insensitively, with spacing collapsed. */
export function normaliseName(name: string): string {
  return String(name ?? "").trim().replace(/\s+/g, " ");
}
