import { differenceInCalendarDays, isValid, parse } from "date-fns";
import prisma from "@/lib/prisma";
import type { RetentionSignals } from "@/analytics/retention";

/**
 * Turns the database into the plain numbers `scoreRetention` needs.
 *
 * All of this is batched: five queries for the whole gym, not five per member.
 * The scoring job runs over every member on a schedule, so a per-member query
 * loop would turn a fast nightly task into a slow one for no benefit.
 *
 * Date handling note: `Attendance.date`, `Sales.endDate` and `Member.DOJ` are
 * `String` columns in "dd-MM-yyyy", a convention inherited from the base repo.
 * That means date ranges cannot be filtered in SQL and are parsed here instead.
 * A production deployment should migrate these to `DateTime`; doing it now
 * would rewrite half the existing actions for no marks.
 */

const DATE_FMT = "dd-MM-yyyy";

/** Parses "dd-MM-yyyy". Returns null for the malformed rows real data contains. */
export function parseGymDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = parse(value, DATE_FMT, new Date());
  return isValid(d) ? d : null;
}

/** Fallback when a member has no plan telling us how often they mean to train. */
const DEFAULT_TARGET_VISITS_PER_WEEK = 3;

export async function gatherSignals(
  asOf: Date = new Date()
): Promise<Map<string, RetentionSignals>> {
  const [members, attendance, sales, plans, sessions] = await Promise.all([
    prisma.member.findMany({
      select: { id: true, DOJ: true, workoutDaysPerWeek: true },
    }),
    prisma.attendance.findMany({
      select: { member_id: true, date: true },
    }),
    prisma.sales.findMany({
      select: { member_id: true, endDate: true, amount: true, paid: true },
    }),
    prisma.workoutPlan.findMany({
      where: { status: "ACTIVE" },
      select: {
        memberId: true,
        createdAt: true,
        daysPerWeek: true,
        durationWeeks: true,
        days: { select: { weekNumber: true, isRestDay: true } },
      },
    }),
    prisma.workoutSession.findMany({
      where: { completed: true },
      select: { memberId: true },
    }),
  ]);

  /* ── visits, bucketed into the last 30 days and the 30 before that ── */

  const visits = new Map<string, { last30: number; prev30: number; mostRecent: Date | null }>();
  for (const row of attendance) {
    const d = parseGymDate(row.date);
    if (!d) continue;
    const age = differenceInCalendarDays(asOf, d);
    if (age < 0) continue; // a check-in dated in the future is bad data

    const bucket = visits.get(row.member_id) ?? { last30: 0, prev30: 0, mostRecent: null };
    if (age <= 30) bucket.last30 += 1;
    else if (age <= 60) bucket.prev30 += 1;
    if (!bucket.mostRecent || d > bucket.mostRecent) bucket.mostRecent = d;
    visits.set(row.member_id, bucket);
  }

  /* ── membership end date and outstanding balance ── */

  const membership = new Map<string, { latestEnd: Date | null; unpaid: number }>();
  for (const row of sales) {
    const entry = membership.get(row.member_id) ?? { latestEnd: null, unpaid: 0 };
    const end = parseGymDate(row.endDate);
    if (end && (!entry.latestEnd || end > entry.latestEnd)) entry.latestEnd = end;
    // Sales.amount and Sales.paid are whole pesos (Payment.amount is centavos —
    // different unit, different table; do not mix them).
    entry.unpaid += Math.max(0, row.amount - row.paid);
    membership.set(row.member_id, entry);
  }

  /* ── plan adherence ── */

  const completedByMember = new Map<string, number>();
  for (const s of sessions) {
    completedByMember.set(s.memberId, (completedByMember.get(s.memberId) ?? 0) + 1);
  }

  const assignedByMember = new Map<string, number>();
  const targetByMember = new Map<string, number>();
  for (const plan of plans) {
    // Only weeks that have actually elapsed count as assigned. Crediting a
    // member with missing sessions they were never yet due to do would mark
    // every new plan as non-adherent on the day it is generated.
    const weeksElapsed = Math.min(
      plan.durationWeeks,
      Math.max(0, Math.floor(differenceInCalendarDays(asOf, plan.createdAt) / 7))
    );
    const due = plan.days.filter((d) => !d.isRestDay && d.weekNumber <= weeksElapsed).length;
    assignedByMember.set(plan.memberId, (assignedByMember.get(plan.memberId) ?? 0) + due);
    targetByMember.set(plan.memberId, plan.daysPerWeek);
  }

  /* ── assemble ── */

  const out = new Map<string, RetentionSignals>();
  for (const m of members) {
    const v = visits.get(m.id);
    const ms = membership.get(m.id);
    const joined = parseGymDate(m.DOJ);

    out.set(m.id, {
      daysSinceLastVisit: v?.mostRecent ? differenceInCalendarDays(asOf, v.mostRecent) : null,
      visitsLast30: v?.last30 ?? 0,
      visitsPrev30: v?.prev30 ?? 0,
      targetVisitsPerWeek:
        targetByMember.get(m.id) ?? m.workoutDaysPerWeek ?? DEFAULT_TARGET_VISITS_PER_WEEK,
      daysUntilMembershipEnds: ms?.latestEnd
        ? differenceInCalendarDays(ms.latestEnd, asOf)
        : null,
      unpaidPesos: ms?.unpaid ?? 0,
      sessionsCompleted: completedByMember.get(m.id) ?? 0,
      sessionsAssigned: assignedByMember.get(m.id) ?? 0,
      // A member with no parseable join date is treated as established rather
      // than new, so a bad DOJ cannot hide a real risk behind the grace period.
      tenureDays: joined ? Math.max(0, differenceInCalendarDays(asOf, joined)) : 9999,
    });
  }

  return out;
}
