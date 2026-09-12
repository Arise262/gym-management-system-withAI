import { addDays, differenceInCalendarDays, format } from "date-fns";
import prisma from "@/lib/prisma";
import { parseGymDate } from "@/analytics/signals";
import { recomputeRetentionScores } from "@/analytics/recompute";
import { computeEngagementMetrics } from "@/analytics/engagement";
import { notify, notifyAdmins, notifyMember, retryUnsentEmails } from "@/lib/notifications";

/**
 * The daily job behind /api/cron/daily.
 *
 * Five steps, each independent and each idempotent through dedupe keys, so the
 * job can be re-run at any time without spamming anyone:
 *
 *   1. membership renewals     — 7, 3 and 1 day(s) before expiry, and on the day
 *   2. workout reminders       — active plan, nothing logged for 3+ days (weekly cap)
 *   3. retention               — recompute scores; alert admins about HIGH/CRITICAL,
 *                                nudge those members without mentioning risk
 *   4. weekly progress update  — Mondays: what the member did last week
 *   5. email retry             — anything with a mail channel that never went out
 *
 * Everything runs sequentially. DATABASE_URL carries connection_limit=1 (the
 * Supabase transaction pooler), so Promise.all would only queue and risk the
 * pool-checkout timeout that bit Phase 3.
 */

const DATE_FMT = "dd-MM-yyyy";

/** Days-before-expiry at which a member is warned. */
export const RENEWAL_LEAD_DAYS = [7, 3, 1, 0] as const;

/** A member with an active plan and no log for this many days gets a nudge. */
export const REMINDER_AFTER_DAYS = 3;

export type DailyRunReport = {
  ranAt: string;
  gymDate: string;
  weekKey: string;
  renewals: { candidates: number; notified: number };
  workoutReminders: { candidates: number; notified: number };
  retention: { scored: number; atRisk: number; adminAlerts: number; nudges: number };
  progress: { ran: boolean; notified: number };
  /** Weekly EngagementMetric rows (guide module 10). Recomputed every run: two round trips. */
  engagement: { weeks: number; members: number; rows: number };
  emailRetry: { attempted: number; sent: number };
  durationMs: number;
};

export type DailyRunOptions = {
  /** Send progress updates even if today is not Monday (for demos and tests). */
  forceWeekly?: boolean;
};

/**
 * The gym's calendar day for a given instant.
 *
 * The cron fires at whatever hour cron-job.org is set to and Vercel runs in
 * UTC, but the gym is in the Philippines and every stored date is a Manila
 * date. Without this, a 23:30 Manila run would compute "tomorrow" in UTC.
 */
export function manilaDay(asOf: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(asOf);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return new Date(get("year"), get("month") - 1, get("day"));
}

/** "2026-W37" — ISO week, used to cap once-a-week notifications. */
export function weekKey(day: Date): string {
  return format(day, "RRRR-'W'II");
}

/* ───────────────────────── 1. membership renewals ───────────────────────── */

const RENEWAL_COPY: Record<number, { title: string; lead: string }> = {
  7: { title: "Your membership ends in a week", lead: "ends on" },
  3: { title: "Your membership ends in 3 days", lead: "ends on" },
  1: { title: "Your membership ends tomorrow", lead: "ends" },
  0: { title: "Your membership ends today", lead: "ends" },
};

export async function sendRenewalReminders(today: Date): Promise<DailyRunReport["renewals"]> {
  const targets = new Map<string, number>(); // "dd-MM-yyyy" -> days left
  for (const d of RENEWAL_LEAD_DAYS) targets.set(format(addDays(today, d), DATE_FMT), d);

  const expiring = await prisma.sales.findMany({
    where: { endDate: { in: [...targets.keys()] } },
    select: {
      id: true,
      member_id: true,
      startDate: true,
      endDate: true,
      amount: true,
      paid: true,
      service: { select: { name: true } },
      member: { select: { name: true } },
    },
  });
  if (expiring.length === 0) return { candidates: 0, notified: 0 };

  // A member who already bought the next period should not be told to renew.
  const memberIds = [...new Set(expiring.map((s) => s.member_id))];
  const allSales = await prisma.sales.findMany({
    where: { member_id: { in: memberIds } },
    select: { id: true, member_id: true, endDate: true },
  });
  const latestEnd = new Map<string, number>();
  for (const s of allSales) {
    const t = parseGymDate(s.endDate)?.getTime() ?? 0;
    if (t > (latestEnd.get(s.member_id) ?? 0)) latestEnd.set(s.member_id, t);
  }

  let notified = 0;
  for (const sale of expiring) {
    const thisEnd = parseGymDate(sale.endDate)?.getTime() ?? 0;
    if ((latestEnd.get(sale.member_id) ?? 0) > thisEnd) continue; // renewed already

    const daysLeft = targets.get(sale.endDate)!;

    // Short plans skip the long leads: a 7-day session would otherwise be
    // told "ends in 3 days" halfway through the week it was just bought for.
    // A lead is sent only if it is under half the plan's length, so a weekly
    // member hears "tomorrow" and "today", and a monthly member all four.
    const start = parseGymDate(sale.startDate);
    const lengthDays = start ? differenceInCalendarDays(new Date(thisEnd), start) : Infinity;
    if (daysLeft > 0 && daysLeft * 2 >= lengthDays) continue;

    const copy = RENEWAL_COPY[daysLeft];
    const balance = Math.max(0, sale.amount - sale.paid);
    const endPretty = format(parseGymDate(sale.endDate)!, "d MMMM yyyy");

    const body =
      `Hi ${sale.member.name.split(" ")[0]}, your ${sale.service.name} membership ${copy.lead} ${endPretty}.` +
      (balance > 0
        ? ` There is an outstanding balance of ₱${balance.toLocaleString("en-PH")} on it.`
        : "") +
      " Renew before it lapses to keep your plan, bookings and progress history running without a gap.";

    const r = await notifyMember(sale.member_id, {
      type: "MEMBERSHIP_RENEWAL",
      title: copy.title,
      body,
      channel: "BOTH",
      actionUrl: "/member/payments",
      metadata: { saleId: sale.id, daysLeft },
      dedupeKey: `renewal:${sale.id}:${daysLeft}`,
    });
    if (r.created) notified += 1;
  }

  return { candidates: expiring.length, notified };
}

/* ───────────────────────── 2. workout reminders ─────────────────────────── */

export async function sendWorkoutReminders(today: Date): Promise<DailyRunReport["workoutReminders"]> {
  const plans = await prisma.workoutPlan.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, memberId: true, title: true, createdAt: true, member: { select: { name: true } } },
  });
  if (plans.length === 0) return { candidates: 0, notified: 0 };

  const sessions = await prisma.workoutSession.findMany({
    where: { memberId: { in: plans.map((p) => p.memberId) } },
    select: { memberId: true, date: true },
  });
  const lastLogged = new Map<string, Date>();
  for (const s of sessions) {
    const d = parseGymDate(s.date);
    if (!d) continue;
    const prev = lastLogged.get(s.memberId);
    if (!prev || d > prev) lastLogged.set(s.memberId, d);
  }

  const wk = weekKey(today);
  let candidates = 0;
  let notified = 0;

  for (const plan of plans) {
    // A plan generated yesterday has had no chance to be followed yet.
    if (differenceInCalendarDays(today, plan.createdAt) < REMINDER_AFTER_DAYS) continue;

    const last = lastLogged.get(plan.memberId);
    const idleDays = last ? differenceInCalendarDays(today, last) : null;
    if (idleDays !== null && idleDays < REMINDER_AFTER_DAYS) continue;
    candidates += 1;

    const first = plan.member.name.split(" ")[0];
    const body =
      idleDays === null
        ? `Hi ${first}, your plan "${plan.title}" is ready but nothing has been logged yet. The first session is the hardest one to start — open the plan and tick off one workout today.`
        : `Hi ${first}, it has been ${idleDays} days since your last logged workout. Your plan "${plan.title}" picks up right where you left it — one session today keeps the streak alive.`;

    const r = await notifyMember(plan.memberId, {
      type: "WORKOUT_REMINDER",
      title: "Time to get back on your plan",
      body,
      channel: "BOTH",
      actionUrl: "/member/workout-plan",
      metadata: { planId: plan.id, idleDays },
      dedupeKey: `workout-reminder:${plan.memberId}:${wk}`,
    });
    if (r.created) notified += 1;
  }

  return { candidates, notified };
}

/* ───────────────────────── 3. retention + nudges ────────────────────────── */

/**
 * Rotated weekly so a member nudged two weeks running does not get the same
 * text twice. None of these mention risk, scores or churn: the member sees a
 * friendly check-in, the admin sees the number. Same rule as the assistant.
 */
const MOTIVATIONAL: string[] = [
  "We noticed it has been a little while — the gym has missed you. Even a short session this week counts, and your trainer is around if you want a hand getting restarted.",
  "Consistency beats intensity. Pick one day this week, show up, and let that be the whole goal. We will be here.",
  "Your progress so far is still yours — nothing resets. Drop in this week and pick up where you left off, no pressure on the numbers.",
  "A quick reminder that your membership includes trainer bookings and a plan built for you. Whenever this week suits, come and use them.",
];

export async function runRetentionAndNudges(today: Date, asOf: Date): Promise<DailyRunReport["retention"]> {
  const summary = await recomputeRetentionScores(asOf);
  if (summary.atRisk.length === 0) {
    return { scored: summary.scored, atRisk: 0, adminAlerts: 0, nudges: 0 };
  }

  const members = await prisma.member.findMany({
    where: { id: { in: summary.atRisk.map((m) => m.memberId) } },
    select: { id: true, name: true, memberCode: true },
  });
  const byId = new Map(members.map((m) => [m.id, m]));

  const wk = weekKey(today);
  const weekIndex = Number(wk.slice(-2)) || 0;
  let adminAlerts = 0;
  let nudges = 0;

  for (const risk of summary.atRisk) {
    const m = byId.get(risk.memberId);
    if (!m) continue;

    adminAlerts += await notifyAdmins({
      type: "RETENTION_ALERT",
      title: `${m.name} is ${risk.riskLevel === "CRITICAL" ? "at critical" : "at high"} risk of leaving`,
      body:
        `${m.name} (${m.memberCode}) scored ${risk.riskScore}/100 on the retention model.` +
        (risk.explanation ? ` ${risk.explanation}` : "") +
        (risk.riskLevel === "CRITICAL" ? " Worth a call today." : " Worth a message this week."),
      channel: "IN_APP",
      actionUrl: `/members/${m.id}`,
      metadata: { memberId: m.id, riskLevel: risk.riskLevel, riskScore: risk.riskScore },
      dedupeKey: `retention:${m.id}:${wk}`,
    });

    const r = await notifyMember(m.id, {
      type: "MOTIVATIONAL",
      title: `A quick hello from CBG Fitness Center, ${m.name.split(" ")[0]}`,
      body: MOTIVATIONAL[weekIndex % MOTIVATIONAL.length],
      channel: "BOTH",
      actionUrl: "/member",
      dedupeKey: `motivational:${m.id}:${wk}`,
    });
    if (r.created) nudges += 1;
  }

  return { scored: summary.scored, atRisk: summary.atRisk.length, adminAlerts, nudges };
}

/* ───────────────────────── 4. weekly progress update ────────────────────── */

export async function sendProgressUpdates(today: Date, force = false): Promise<DailyRunReport["progress"]> {
  const isMonday = today.getDay() === 1;
  if (!isMonday && !force) return { ran: false, notified: 0 };

  const sessions = await prisma.workoutSession.findMany({
    where: { completed: true },
    select: {
      memberId: true,
      date: true,
      durationMinutes: true,
      perceivedExertion: true,
      _count: { select: { logs: true } },
    },
  });

  type Agg = { workouts: number; exercises: number; minutes: number; rpeSum: number; rpeN: number };
  const agg = new Map<string, Agg>();
  for (const s of sessions) {
    const d = parseGymDate(s.date);
    if (!d) continue;
    const age = differenceInCalendarDays(today, d);
    if (age < 1 || age > 7) continue;
    const a = agg.get(s.memberId) ?? { workouts: 0, exercises: 0, minutes: 0, rpeSum: 0, rpeN: 0 };
    a.workouts += 1;
    a.exercises += s._count.logs;
    a.minutes += s.durationMinutes ?? 0;
    if (s.perceivedExertion) {
      a.rpeSum += s.perceivedExertion;
      a.rpeN += 1;
    }
    agg.set(s.memberId, a);
  }
  if (agg.size === 0) return { ran: true, notified: 0 };

  const members = await prisma.member.findMany({
    where: { id: { in: [...agg.keys()] } },
    select: { id: true, name: true },
  });

  const wk = weekKey(today);
  let notified = 0;
  for (const m of members) {
    const a = agg.get(m.id)!;
    const parts = [`${a.workouts} workout${a.workouts === 1 ? "" : "s"}`, `${a.exercises} exercises logged`];
    if (a.minutes > 0) parts.push(`${a.minutes} minutes trained`);
    if (a.rpeN > 0) parts.push(`average effort ${(a.rpeSum / a.rpeN).toFixed(1)}/10`);

    const r = await notifyMember(m.id, {
      type: "PROGRESS_UPDATE",
      title: "Your week in the gym",
      body: `Hi ${m.name.split(" ")[0]}, last week you completed ${parts.join(", ")}. Keep it going — your plan progresses every week you stay on it.`,
      channel: "BOTH",
      actionUrl: "/member/workout-plan",
      metadata: a,
      dedupeKey: `progress:${m.id}:${wk}`,
    });
    if (r.created) notified += 1;
  }

  return { ran: true, notified };
}

/* ───────────────────────── the whole job ────────────────────────────────── */

export async function runDailyJob(asOf = new Date(), opts: DailyRunOptions = {}): Promise<DailyRunReport> {
  const started = Date.now();
  const today = manilaDay(asOf);

  const renewals = await sendRenewalReminders(today);
  const workoutReminders = await sendWorkoutReminders(today);
  const retention = await runRetentionAndNudges(today, asOf);
  const progress = await sendProgressUpdates(today, opts.forceWeekly);
  const engagement = await computeEngagementMetrics(today);
  const emailRetry = await retryUnsentEmails(asOf);

  return {
    ranAt: asOf.toISOString(),
    gymDate: format(today, DATE_FMT),
    weekKey: weekKey(today),
    renewals,
    workoutReminders,
    retention,
    progress,
    engagement,
    emailRetry,
    durationMs: Date.now() - started,
  };
}

// Re-exported so callers that only need one-off sends do not import two modules.
export { notify };
