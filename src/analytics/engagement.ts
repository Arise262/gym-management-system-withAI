import { addDays, differenceInCalendarDays, startOfISOWeek } from "date-fns";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { parseGymDate } from "@/analytics/signals";

/**
 * Member engagement monitoring (guide module 10).
 *
 * One `EngagementMetric` row per member per ISO week: how often they came in,
 * how many plan workouts they completed against how many were assigned, and a
 * single 0–100 engagement score. Stored, not derived on the fly, so the
 * history survives plan changes and can be charted on the dashboards.
 *
 * Like retention, the score is a reasoned formula rather than a fitted model:
 *
 *   score = 100 × ( 0.5 × min(1, attendance / 3) + 0.5 × consistency )
 *
 * where consistency is completed/assigned for a member on a plan, and
 * min(1, completed / 3) for a member without one — three sessions a week is
 * the "fully engaged" bar in both terms. The 50/50 split is deliberate: showing
 * up and following the plan are the two behaviours the gym can act on.
 */

/** Sessions per week that count as fully engaged, for members with no plan. */
export const FULL_ENGAGEMENT_SESSIONS = 3;

export type EngagementInputs = {
  attendanceCount: number;
  workoutsCompleted: number;
  workoutsAssigned: number;
};

export function scoreEngagement(i: EngagementInputs): { consistencyRate: number; engagementScore: number } {
  const attendance = Math.min(1, i.attendanceCount / FULL_ENGAGEMENT_SESSIONS);
  const consistency =
    i.workoutsAssigned > 0
      ? Math.min(1, i.workoutsCompleted / i.workoutsAssigned)
      : Math.min(1, i.workoutsCompleted / FULL_ENGAGEMENT_SESSIONS);
  const score = Math.round(100 * (0.5 * attendance + 0.5 * consistency));
  return {
    consistencyRate: Math.round(consistency * 1000) / 1000,
    engagementScore: Math.max(0, Math.min(100, score)),
  };
}

/** Monday 00:00 (local) of the ISO week containing `d`. */
export function isoWeekStart(d: Date): Date {
  return startOfISOWeek(d);
}

/** The stored key for a week: its Monday as a UTC-midnight instant, stable across time zones. */
export function weekKeyDate(monday: Date): Date {
  return new Date(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()));
}

/**
 * The last `weeksBack` COMPLETE weeks before the week containing `today`,
 * oldest first. The current week is excluded — it is not over yet.
 */
export function completedWeeks(today: Date, weeksBack: number): Array<{ start: Date; end: Date }> {
  const thisMonday = isoWeekStart(today);
  const weeks: Array<{ start: Date; end: Date }> = [];
  for (let i = weeksBack; i >= 1; i--) {
    const start = addDays(thisMonday, -7 * i);
    weeks.push({ start, end: addDays(start, 6) });
  }
  return weeks;
}

function inWeek(d: Date | null, w: { start: Date; end: Date }): boolean {
  if (!d) return false;
  return differenceInCalendarDays(d, w.start) >= 0 && differenceInCalendarDays(w.end, d) >= 0;
}

export type EngagementRunSummary = { weeks: number; members: number; rows: number };

/**
 * Recomputes the last `weeksBack` complete weeks for every member and replaces
 * those rows in one transaction — two round trips regardless of gym size, the
 * same shape as the retention recompute and for the same latency reason.
 *
 * Recomputing a trailing window rather than only "last week" means a check-in
 * back-filled by staff on Tuesday still lands in the right week's numbers.
 */
export async function computeEngagementMetrics(today = new Date(), weeksBack = 8): Promise<EngagementRunSummary> {
  const weeks = completedWeeks(today, weeksBack);
  if (weeks.length === 0) return { weeks: 0, members: 0, rows: 0 };

  const members = await prisma.member.findMany({ select: { id: true, DOJ: true } });
  const attendance = await prisma.attendance.findMany({ select: { member_id: true, date: true } });
  const sessions = await prisma.workoutSession.findMany({
    where: { completed: true },
    select: { memberId: true, date: true },
  });
  const plans = await prisma.workoutPlan.findMany({
    where: { status: { in: ["ACTIVE", "COMPLETED"] } },
    select: { memberId: true, daysPerWeek: true, createdAt: true, durationWeeks: true },
  });

  const attendanceBy = new Map<string, Date[]>();
  for (const a of attendance) {
    const d = parseGymDate(a.date);
    if (d) (attendanceBy.get(a.member_id) ?? attendanceBy.set(a.member_id, []).get(a.member_id)!).push(d);
  }
  const sessionsBy = new Map<string, Date[]>();
  for (const s of sessions) {
    const d = parseGymDate(s.date);
    if (d) (sessionsBy.get(s.memberId) ?? sessionsBy.set(s.memberId, []).get(s.memberId)!).push(d);
  }
  const plansBy = new Map<string, typeof plans>();
  for (const p of plans) (plansBy.get(p.memberId) ?? plansBy.set(p.memberId, []).get(p.memberId)!).push(p);

  const rows: Prisma.EngagementMetricCreateManyInput[] = [];
  for (const m of members) {
    const joined = parseGymDate(m.DOJ);
    for (const w of weeks) {
      // No row for weeks before the member existed: a zero there would read as
      // eight weeks of absence for someone who joined on Monday.
      if (joined && differenceInCalendarDays(w.end, joined) < 0) continue;

      const attendanceCount = (attendanceBy.get(m.id) ?? []).filter((d) => inWeek(d, w)).length;
      const workoutsCompleted = (sessionsBy.get(m.id) ?? []).filter((d) => inWeek(d, w)).length;

      // Assigned = the plan that was live during that week, if any. A plan
      // created mid-week counts from that week; one that had run its course
      // (createdAt + durationWeeks) stops assigning.
      let workoutsAssigned = 0;
      for (const p of plansBy.get(m.id) ?? []) {
        const planStart = p.createdAt;
        const planEnd = addDays(planStart, p.durationWeeks * 7);
        if (planStart <= w.end && planEnd >= w.start) workoutsAssigned = Math.max(workoutsAssigned, p.daysPerWeek);
      }

      const { consistencyRate, engagementScore } = scoreEngagement({ attendanceCount, workoutsCompleted, workoutsAssigned });
      rows.push({
        memberId: m.id,
        periodStart: weekKeyDate(w.start),
        periodEnd: weekKeyDate(w.end),
        attendanceCount,
        workoutsCompleted,
        workoutsAssigned,
        consistencyRate,
        engagementScore,
      });
    }
  }

  const starts = weeks.map((w) => weekKeyDate(w.start));
  await prisma.$transaction([
    prisma.engagementMetric.deleteMany({ where: { periodStart: { in: starts } } }),
    prisma.engagementMetric.createMany({ data: rows }),
  ]);

  return { weeks: weeks.length, members: members.length, rows: rows.length };
}
