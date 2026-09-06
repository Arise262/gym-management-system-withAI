/**
 * Turning a trainer's weekly availability into bookable slots for a date.
 *
 * Pure functions, no database and no clock of their own — the caller passes
 * `now`. That is what makes "is this slot in the past" testable without
 * waiting, and it is why the booking action and the UI can agree on which
 * slots exist rather than each deciding for itself.
 */

/**
 * One booking is one hour, matching Trainer.hourlyRate. A trainer whose
 * availability window does not divide evenly simply has a shorter tail that
 * produces no slot — a 09:00-10:30 window yields 09:00 only, never a 10:00
 * slot that overruns the window.
 */
export const SLOT_MINUTES = 60;

export type AvailabilityWindow = {
  /** 0 = Sunday .. 6 = Saturday, matching Date.getDay(). */
  dayOfWeek: number;
  /** "HH:mm", 24-hour wall clock. */
  startTime: string;
  endTime: string;
};

export type Slot = {
  /** "HH:mm" — also the value stored on Booking.startTime. */
  startTime: string;
  endTime: string;
  available: boolean;
  /** Why not, when unavailable. Shown to the member rather than hiding rows. */
  reason?: "booked" | "past";
};

/** "HH:mm" -> minutes since midnight. Returns null for anything malformed. */
export function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Minutes since midnight -> "HH:mm", zero-padded. */
export function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Every slot a trainer offers on `date`, marked available or not.
 *
 * Unavailable slots are returned rather than filtered out. A member looking at
 * a day where everything is taken should see that the trainer works that day
 * and is full, not an empty page that looks like a bug.
 */
export function slotsForDate(
  availability: AvailabilityWindow[],
  date: Date,
  takenStartTimes: string[],
  now: Date
): Slot[] {
  const windows = availability.filter((a) => a.dayOfWeek === date.getDay());
  const taken = new Set(takenStartTimes);
  const slots: Slot[] = [];

  for (const w of windows) {
    const start = toMinutes(w.startTime);
    const end = toMinutes(w.endTime);
    // Skip malformed or inverted windows rather than emitting nonsense slots.
    if (start === null || end === null || end <= start) continue;

    for (let t = start; t + SLOT_MINUTES <= end; t += SLOT_MINUTES) {
      const startTime = toHHMM(t);
      const slotStart = new Date(date);
      slotStart.setHours(Math.floor(t / 60), t % 60, 0, 0);

      const isPast = slotStart.getTime() <= now.getTime();
      const isTaken = taken.has(startTime);

      slots.push({
        startTime,
        endTime: toHHMM(t + SLOT_MINUTES),
        available: !isPast && !isTaken,
        // Past wins over booked: a member cannot act on either, and "that time
        // has gone" is the more useful of the two explanations.
        reason: isPast ? "past" : isTaken ? "booked" : undefined,
      });
    }
  }

  // A trainer may have two windows in a day (morning and evening); sorting
  // keeps the UI chronological without the caller thinking about it.
  return slots.sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/** The days a trainer works, as day-of-week numbers. Drives the date picker. */
export function workingDays(availability: AvailabilityWindow[]): number[] {
  return [...new Set(availability.map((a) => a.dayOfWeek))].sort((a, b) => a - b);
}
