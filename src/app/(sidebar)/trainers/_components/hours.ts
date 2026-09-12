import { formatClock } from "@/lib/format";

export type Window = { dayOfWeek: number; startTime: string; endTime: string };

/** Monday first, as a gym schedule reads — dayOfWeek itself is JS order (0 = Sunday). */
export const WEEK: Array<{ dayOfWeek: number; short: string; long: string }> = [
  { dayOfWeek: 1, short: "Mon", long: "Monday" },
  { dayOfWeek: 2, short: "Tue", long: "Tuesday" },
  { dayOfWeek: 3, short: "Wed", long: "Wednesday" },
  { dayOfWeek: 4, short: "Thu", long: "Thursday" },
  { dayOfWeek: 5, short: "Fri", long: "Friday" },
  { dayOfWeek: 6, short: "Sat", long: "Saturday" },
  { dayOfWeek: 0, short: "Sun", long: "Sunday" },
];

/**
 * "Mon–Fri 9:00 am – 5:00 pm, Sat 8:00 am – 12:00 pm". Consecutive days with
 * the same hours collapse into a range, so a normal week is one short line.
 */
export function summariseHours(windows: Window[]): string {
  const byDay = new Map(windows.map((w) => [w.dayOfWeek, `${formatClock(w.startTime)} – ${formatClock(w.endTime)}`]));
  const groups: Array<{ from: string; to: string; hours: string }> = [];
  let prevWorked = false;
  for (const d of WEEK) {
    const hours = byDay.get(d.dayOfWeek);
    if (!hours) {
      prevWorked = false;
      continue;
    }
    const last = groups[groups.length - 1];
    if (prevWorked && last && last.hours === hours) last.to = d.short;
    else groups.push({ from: d.short, to: d.short, hours });
    prevWorked = true;
  }
  if (groups.length === 0) return "No hours set";
  return groups.map((g) => `${g.from === g.to ? g.from : `${g.from}–${g.to}`} ${g.hours}`).join(", ");
}
