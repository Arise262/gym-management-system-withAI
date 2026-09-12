import { addDays, addMonths } from "date-fns";
import type { DurationUnit } from "@prisma/client";

/**
 * The last day a purchase covers.
 *
 * MONTH keeps the rule sales have always used — `addMonths(start, n)` — so
 * existing memberships and their renewal dates do not move.
 *
 * DAY counts the start day as day one: a 7-day session bought on a Saturday
 * covers through the Friday. Otherwise "7 days" would mean eight visits.
 */
export function coverageEnd(start: Date, duration: number, unit: DurationUnit): Date {
  return unit === "DAY" ? addDays(start, duration - 1) : addMonths(start, duration);
}

/** "1 month", "12 months", "7 days". */
export function formatDuration(duration: number, unit: DurationUnit): string {
  const word = unit === "DAY" ? "day" : "month";
  return `${duration} ${word}${duration === 1 ? "" : "s"}`;
}
