"use server";

import { addDays, differenceInCalendarDays, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import type { BookingStatus, RiskLevel } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireMemberId, requireRole } from "@/lib/session";
import { parseGymDate } from "@/analytics/signals";
import { completedWeeks, isoWeekStart, weekKeyDate } from "@/analytics/engagement";

/**
 * Dashboards (guide module 9: reporting; module 10: engagement monitoring).
 *
 * Every function here is read-only and returns plain JSON-safe data shaped for
 * the charts, so the pages are server components with no client fetching.
 *
 * Money convention, matching sales.action.ts and the pending-payments page:
 *   billed    = amount - discount        (what the member owes for the period)
 *   collected = paid                     (whole pesos; the webhook adds to it)
 *   due       = amount - discount - paid
 *
 * Walk-ins (non-members paying per session) count as revenue on the day of the
 * visit: billed = amount, collected = amount once paidAt is set. They are not
 * in "outstanding", which is membership balances only.
 *
 * Dates: Attendance.date, Sales.startDate/endDate, WorkoutSession.date are all
 * "dd-MM-yyyy" strings, so nothing here filters by date in SQL. Each table is
 * read once and bucketed in TypeScript — one round trip per table, which is
 * what matters over the Supabase pooler (see analytics/recompute.ts).
 */

const DATE_FMT = "dd-MM-yyyy";

/* ═══════════════════════════════ admin ═══════════════════════════════ */

export type AdminDashboard = {
  asOf: string;
  members: {
    total: number;
    active: number;
    newThisMonth: number;
    expiring7: Array<{ id: string; name: string; memberCode: string; endDate: string; service: string; due: number }>;
  };
  revenue: {
    months: Array<{ label: string; a: number; b: number }>; // a = billed, b = collected
    thisMonthBilled: number;
    thisMonthCollected: number;
    outstanding: number;
    onlinePaidThisMonth: number; // pesos, from PayMongo payments
    walkInsThisMonth: number;
    walkInCashThisMonth: number;
  };
  attendance: {
    days: Array<{ label: string; value: number; date: string }>;
    checkins7: number;
    uniqueMembers7: number;
    uniqueMembers30: number;
    avgPerDay30: number;
    walkIns7: number;
  };
  retention: { byLevel: Record<RiskLevel, number>; lastRun: string | null; total: number };
  engagement: {
    weeks: Array<{ label: string; value: number; start: string; avgScore: number | null }>;
    activePlans: number;
    avgScoreLastWeek: number | null;
    avgConsistencyLastWeek: number | null;
  };
  bookings: { thisWeek: Record<BookingStatus, number>; upcoming: number };
  ai: { aiPlans: number; aiPlansThisMonth: number; assistantReplies: number; notifications7d: number };
};

function emptyLevels(): Record<RiskLevel, number> {
  return { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
}

export async function GetAdminDashboard(): Promise<AdminDashboard> {
  await requireRole("ADMIN");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = startOfMonth(today);

  /* ── members & sales ── */
  const members = await prisma.member.findMany({ select: { id: true, name: true, memberCode: true, DOJ: true } });
  const sales = await prisma.sales.findMany({
    select: {
      id: true,
      member_id: true,
      startDate: true,
      endDate: true,
      amount: true,
      discount: true,
      paid: true,
      createdAt: true,
      service: { select: { name: true } },
    },
  });

  const memberById = new Map(members.map((m) => [m.id, m]));
  const activeMembers = new Set<string>();
  let outstanding = 0;
  const expiring7: AdminDashboard["members"]["expiring7"] = [];
  const latestEnd = new Map<string, number>();
  for (const s of sales) {
    const t = parseGymDate(s.endDate)?.getTime() ?? 0;
    if (t > (latestEnd.get(s.member_id) ?? 0)) latestEnd.set(s.member_id, t);
  }
  for (const s of sales) {
    const start = parseGymDate(s.startDate);
    const end = parseGymDate(s.endDate);
    const due = Math.max(0, s.amount - s.discount - s.paid);
    outstanding += due;
    if (start && end && start <= today && end >= today) activeMembers.add(s.member_id);
    if (end) {
      const daysLeft = differenceInCalendarDays(end, today);
      const isLatest = end.getTime() === latestEnd.get(s.member_id);
      if (daysLeft >= 0 && daysLeft <= 7 && isLatest) {
        const m = memberById.get(s.member_id);
        if (m) expiring7.push({ id: m.id, name: m.name, memberCode: m.memberCode, endDate: s.endDate, service: s.service.name, due });
      }
    }
  }
  expiring7.sort((a, b) => (parseGymDate(a.endDate)?.getTime() ?? 0) - (parseGymDate(b.endDate)?.getTime() ?? 0));

  const newThisMonth = members.filter((m) => {
    const d = parseGymDate(m.DOJ);
    return d && d >= monthStart && d <= today;
  }).length;

  /* ── revenue by month, last 6 (by sale start month, as the Sales page does) ── */
  const months: AdminDashboard["revenue"]["months"] = [];
  const monthIndex = new Map<string, number>();
  for (let i = 5; i >= 0; i--) {
    const d = subMonths(monthStart, i);
    const key = format(d, "yyyy-MM");
    monthIndex.set(key, months.length);
    months.push({ label: format(d, "MMM"), a: 0, b: 0 });
  }
  let thisMonthBilled = 0;
  let thisMonthCollected = 0;
  const thisKey = format(monthStart, "yyyy-MM");
  for (const s of sales) {
    const start = parseGymDate(s.startDate);
    if (!start) continue;
    const key = format(start, "yyyy-MM");
    const idx = monthIndex.get(key);
    if (idx === undefined) continue;
    const billed = Math.max(0, s.amount - s.discount);
    months[idx].a += billed;
    months[idx].b += s.paid;
    if (key === thisKey) {
      thisMonthBilled += billed;
      thisMonthCollected += s.paid;
    }
  }

  // Walk-in fees land in the month of the visit, beside the memberships.
  const walkIns = await prisma.walkIn.findMany({ select: { date: true, amount: true, paidAt: true } });
  let walkInsThisMonth = 0;
  let walkInCashThisMonth = 0;
  for (const w of walkIns) {
    const d = parseGymDate(w.date);
    if (!d) continue;
    const key = format(d, "yyyy-MM");
    const idx = monthIndex.get(key);
    if (idx === undefined) continue;
    const collected = w.paidAt ? w.amount : 0;
    months[idx].a += w.amount;
    months[idx].b += collected;
    if (key === thisKey) {
      thisMonthBilled += w.amount;
      thisMonthCollected += collected;
      walkInsThisMonth += 1;
      walkInCashThisMonth += collected;
    }
  }

  // provider "paymongo" only — desk cash is also a PAID Payment row now, and
  // counting it here would label cash as online.
  const onlinePaid = await prisma.payment.aggregate({
    _sum: { amount: true },
    where: { status: "PAID", provider: "paymongo", paidAt: { gte: monthStart } },
  });
  const onlinePaidThisMonth = Math.round((onlinePaid._sum.amount ?? 0) / 100);

  /* ── attendance, last 30 days ── */
  const attendance = await prisma.attendance.findMany({ select: { member_id: true, date: true } });
  const dayIndex = new Map<string, number>();
  const days: AdminDashboard["attendance"]["days"] = [];
  for (let i = 29; i >= 0; i--) {
    const d = addDays(today, -i);
    const key = format(d, DATE_FMT);
    dayIndex.set(key, days.length);
    days.push({ label: format(d, "d MMM"), value: 0, date: key });
  }
  const uniq7 = new Set<string>();
  const uniq30 = new Set<string>();
  let checkins7 = 0;
  let checkins30 = 0;
  let walkIns7 = 0;
  for (const w of walkIns) {
    const idx = dayIndex.get(w.date);
    if (idx !== undefined && idx >= days.length - 7) walkIns7 += 1;
  }
  for (const a of attendance) {
    const idx = dayIndex.get(a.date);
    if (idx === undefined) continue;
    days[idx].value += 1;
    checkins30 += 1;
    uniq30.add(a.member_id);
    if (idx >= days.length - 7) {
      checkins7 += 1;
      uniq7.add(a.member_id);
    }
  }

  /* ── retention: latest run ── */
  const latestScore = await prisma.retentionScore.findFirst({ orderBy: { scoreDate: "desc" }, select: { scoreDate: true } });
  const byLevel = emptyLevels();
  if (latestScore) {
    const grouped = await prisma.retentionScore.groupBy({
      by: ["riskLevel"],
      where: { scoreDate: latestScore.scoreDate },
      _count: { _all: true },
    });
    for (const g of grouped) byLevel[g.riskLevel] = g._count._all;
  }

  /* ── engagement: last 8 complete weeks ── */
  const weeks = completedWeeks(today, 8);
  const weekStarts = weeks.map((w) => weekKeyDate(w.start));
  const metrics = await prisma.engagementMetric.findMany({
    where: { periodStart: { in: weekStarts } },
    select: { periodStart: true, workoutsCompleted: true, engagementScore: true, consistencyRate: true },
  });
  const engWeeks: AdminDashboard["engagement"]["weeks"] = weeks.map((w) => ({
    label: format(w.start, "d MMM"),
    value: 0,
    start: w.start.toISOString(),
    avgScore: null,
  }));
  const scoreAcc = weeks.map(() => ({ sum: 0, n: 0, cons: 0 }));
  for (const m of metrics) {
    const idx = weekStarts.findIndex((d) => d.getTime() === m.periodStart.getTime());
    if (idx < 0) continue;
    engWeeks[idx].value += m.workoutsCompleted;
    scoreAcc[idx].sum += m.engagementScore;
    scoreAcc[idx].cons += m.consistencyRate;
    scoreAcc[idx].n += 1;
  }
  scoreAcc.forEach((s, i) => (engWeeks[i].avgScore = s.n ? Math.round(s.sum / s.n) : null));
  const last = scoreAcc[scoreAcc.length - 1];
  const activePlans = await prisma.workoutPlan.count({ where: { status: "ACTIVE" } });

  /* ── bookings this week ── */
  const weekStart = isoWeekStart(today);
  const weekEnd = addDays(weekStart, 6);
  const bookings = await prisma.booking.findMany({ select: { date: true, status: true } });
  const thisWeek: Record<BookingStatus, number> = { PENDING: 0, CONFIRMED: 0, COMPLETED: 0, CANCELLED: 0, NO_SHOW: 0 };
  let upcoming = 0;
  for (const b of bookings) {
    const d = parseGymDate(b.date);
    if (!d) continue;
    if (d >= weekStart && d <= weekEnd) thisWeek[b.status] += 1;
    if (d >= today && (b.status === "PENDING" || b.status === "CONFIRMED")) upcoming += 1;
  }

  /* ── AI usage ── */
  const aiPlans = await prisma.workoutPlan.count({ where: { generatedBy: "AI" } });
  const aiPlansThisMonth = await prisma.workoutPlan.count({ where: { generatedBy: "AI", createdAt: { gte: monthStart } } });
  const assistantReplies = await prisma.message.count({ where: { role: "ASSISTANT" } });
  const notifications7d = await prisma.notification.count({ where: { createdAt: { gte: addDays(now, -7) } } });

  return {
    asOf: now.toISOString(),
    members: { total: members.length, active: activeMembers.size, newThisMonth, expiring7 },
    revenue: { months, thisMonthBilled, thisMonthCollected, outstanding, onlinePaidThisMonth, walkInsThisMonth, walkInCashThisMonth },
    attendance: {
      days,
      checkins7,
      uniqueMembers7: uniq7.size,
      uniqueMembers30: uniq30.size,
      avgPerDay30: Math.round((checkins30 / 30) * 10) / 10,
      walkIns7,
    },
    retention: { byLevel, lastRun: latestScore ? latestScore.scoreDate.toISOString() : null, total: Object.values(byLevel).reduce((a, b) => a + b, 0) },
    engagement: {
      weeks: engWeeks,
      activePlans,
      avgScoreLastWeek: last && last.n ? Math.round(last.sum / last.n) : null,
      avgConsistencyLastWeek: last && last.n ? Math.round((last.cons / last.n) * 100) : null,
    },
    bookings: { thisWeek, upcoming },
    ai: { aiPlans, aiPlansThisMonth, assistantReplies, notifications7d },
  };
}

/* ═══════════════════════════════ member ══════════════════════════════ */

export type MemberProgress = {
  weeks: Array<{ label: string; workouts: number; volumeKg: number; start: string }>;
  totals: { workouts: number; exercises: number; minutes: number };
  streakWeeks: number;
  attendance: { thisMonth: number; last30: number };
  plan: { title: string; adherencePct: number; completed: number; assignedSoFar: number; weekOf: number; durationWeeks: number } | null;
  weights: Array<{ label: string; value: number; date: string }>;
  latest: { engagementScore: number; consistencyRate: number; weekLabel: string } | null;
};

/** "8-12" -> 8, "10" -> 10, "AMRAP" -> 0. Volume needs a number; the low end of a range is the honest one. */
function repsToNumber(reps: string | null): number {
  const m = reps?.match(/\d+/);
  return m ? Number(m[0]) : 0;
}

export async function GetMemberProgress(): Promise<MemberProgress> {
  const memberId = await requireMemberId();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const sessions = await prisma.workoutSession.findMany({
    where: { memberId, completed: true },
    select: {
      date: true,
      durationMinutes: true,
      planDayId: true,
      createdAt: true,
      logs: { select: { setsCompleted: true, repsCompleted: true, weightKg: true, completed: true } },
    },
  });

  // Eight complete weeks plus the current one, oldest first.
  const past = completedWeeks(today, 7);
  const thisMonday = isoWeekStart(today);
  const weeks = [...past, { start: thisMonday, end: addDays(thisMonday, 6) }];
  const buckets = weeks.map((w) => ({ label: format(w.start, "d MMM"), workouts: 0, volumeKg: 0, start: w.start.toISOString() }));

  let totalExercises = 0;
  let totalMinutes = 0;
  for (const s of sessions) {
    const d = parseGymDate(s.date);
    totalExercises += s.logs.filter((l) => l.completed).length;
    totalMinutes += s.durationMinutes ?? 0;
    if (!d) continue;
    const idx = weeks.findIndex((w) => d >= w.start && d <= w.end);
    if (idx < 0) continue;
    buckets[idx].workouts += 1;
    for (const l of s.logs) {
      if (!l.completed) continue;
      buckets[idx].volumeKg += l.setsCompleted * repsToNumber(l.repsCompleted) * (l.weightKg ?? 0);
    }
  }
  buckets.forEach((b) => (b.volumeKg = Math.round(b.volumeKg)));

  // Streak: consecutive weeks with >= 1 workout, counting back from this week
  // (or from last week if this week is still empty — the week is not over).
  let streak = 0;
  let i = buckets.length - 1;
  if (buckets[i].workouts === 0) i -= 1;
  for (; i >= 0 && buckets[i].workouts > 0; i--) streak += 1;

  /* ── attendance ── */
  const attendance = await prisma.attendance.findMany({ where: { member_id: memberId }, select: { date: true } });
  const monthStart = startOfMonth(today);
  let thisMonth = 0;
  let last30 = 0;
  for (const a of attendance) {
    const d = parseGymDate(a.date);
    if (!d) continue;
    if (d >= monthStart && d <= today) thisMonth += 1;
    if (differenceInCalendarDays(today, d) < 30 && d <= today) last30 += 1;
  }

  /* ── active plan adherence ── */
  const plan = await prisma.workoutPlan.findFirst({
    where: { memberId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, daysPerWeek: true, durationWeeks: true, createdAt: true, days: { select: { id: true } } },
  });
  let planOut: MemberProgress["plan"] = null;
  if (plan) {
    const dayIds = new Set(plan.days.map((d) => d.id));
    const completed = sessions.filter((s) => s.planDayId && dayIds.has(s.planDayId)).length;
    const weekOf = Math.min(plan.durationWeeks, Math.floor(differenceInCalendarDays(today, plan.createdAt) / 7) + 1);
    const assignedSoFar = Math.max(plan.daysPerWeek, weekOf * plan.daysPerWeek);
    planOut = {
      title: plan.title,
      completed,
      assignedSoFar,
      adherencePct: Math.min(100, Math.round((completed / assignedSoFar) * 100)),
      weekOf,
      durationWeeks: plan.durationWeeks,
    };
  }

  /* ── body weight trend ── */
  const records = await prisma.fitnessRecord.findMany({ where: { member_id: memberId }, select: { date: true, weight: true } });
  const weights = records
    .map((r) => ({ d: parseGymDate(r.date), weight: r.weight, date: r.date }))
    .filter((r): r is { d: Date; weight: number; date: string } => Boolean(r.d) && r.weight > 0)
    .sort((a, b) => a.d.getTime() - b.d.getTime())
    .map((r) => ({ label: format(r.d, "d MMM"), value: r.weight, date: r.date }));

  /* ── latest engagement metric ── */
  const metric = await prisma.engagementMetric.findFirst({
    where: { memberId },
    orderBy: { periodStart: "desc" },
    select: { engagementScore: true, consistencyRate: true, periodStart: true },
  });

  return {
    weeks: buckets,
    totals: { workouts: sessions.length, exercises: totalExercises, minutes: totalMinutes },
    streakWeeks: streak,
    attendance: { thisMonth, last30 },
    plan: planOut,
    weights,
    latest: metric
      ? {
          engagementScore: metric.engagementScore,
          consistencyRate: Math.round(metric.consistencyRate * 100),
          weekLabel: format(new Date(metric.periodStart.getUTCFullYear(), metric.periodStart.getUTCMonth(), metric.periodStart.getUTCDate()), "d MMM"),
        }
      : null,
  };
}

/* ═══════════════════════════════ trainer ═════════════════════════════ */

export type TrainerClient = {
  memberId: string;
  name: string;
  memberCode: string;
  activePlan: string | null;
  lastWorkout: string | null; // "dd-MM-yyyy"
  daysSinceWorkout: number | null;
  sessionsThisMonth: number;
  engagementScore: number | null;
};

/** The trainer's roster: everyone who has booked them or trains on a plan they own. */
export async function GetTrainerClients(): Promise<TrainerClient[]> {
  const user = await requireRole("TRAINER");
  const trainer = await prisma.trainer.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!trainer) return [];

  const bookings = await prisma.booking.findMany({
    where: { trainerId: trainer.id, status: { not: "CANCELLED" } },
    select: { memberId: true, date: true, status: true },
  });
  const plans = await prisma.workoutPlan.findMany({
    where: { trainerId: trainer.id },
    select: { memberId: true, title: true, status: true },
  });
  const ids = [...new Set([...bookings.map((b) => b.memberId), ...plans.map((p) => p.memberId)])];
  if (ids.length === 0) return [];

  const members = await prisma.member.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, memberCode: true } });
  const activePlans = await prisma.workoutPlan.findMany({
    where: { memberId: { in: ids }, status: "ACTIVE" },
    select: { memberId: true, title: true },
  });
  const sessions = await prisma.workoutSession.findMany({
    where: { memberId: { in: ids }, completed: true },
    select: { memberId: true, date: true },
  });
  const latestMetrics = await prisma.engagementMetric.findMany({
    where: { memberId: { in: ids } },
    orderBy: { periodStart: "desc" },
    select: { memberId: true, engagementScore: true },
  });

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const lastWorkout = new Map<string, Date>();
  for (const s of sessions) {
    const d = parseGymDate(s.date);
    if (!d) continue;
    const prev = lastWorkout.get(s.memberId);
    if (!prev || d > prev) lastWorkout.set(s.memberId, d);
  }
  const planBy = new Map(activePlans.map((p) => [p.memberId, p.title]));
  const scoreBy = new Map<string, number>();
  for (const m of latestMetrics) if (!scoreBy.has(m.memberId)) scoreBy.set(m.memberId, m.engagementScore);

  return members
    .map((m) => {
      const lw = lastWorkout.get(m.id) ?? null;
      return {
        memberId: m.id,
        name: m.name,
        memberCode: m.memberCode,
        activePlan: planBy.get(m.id) ?? null,
        lastWorkout: lw ? format(lw, DATE_FMT) : null,
        daysSinceWorkout: lw ? differenceInCalendarDays(today, lw) : null,
        sessionsThisMonth: bookings.filter((b) => {
          const d = parseGymDate(b.date);
          return b.memberId === m.id && d && d >= monthStart && d <= monthEnd && b.status !== "NO_SHOW";
        }).length,
        engagementScore: scoreBy.get(m.id) ?? null,
      };
    })
    .sort((a, b) => (b.daysSinceWorkout ?? 999) - (a.daysSinceWorkout ?? 999));
}
