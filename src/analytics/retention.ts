import type { RiskLevel } from "@prisma/client";

/**
 * Retention risk scoring.
 *
 * Deliberately NOT an LLM call. Three reasons, in the order a panel will ask:
 *
 *   1. Explainability. Every point of the score traces to a named factor with a
 *      published weight, so "why is this member at risk" has an exact answer
 *      rather than a paraphrase of a model's opinion.
 *   2. Determinism. The same inputs always give the same score, which is what
 *      makes it testable and what lets the number be trusted week to week.
 *   3. Cost. This runs over every member on a schedule. A model call per member
 *      per night is a recurring bill for a worse answer.
 *
 * The shape is a weighted linear model — the same form a logistic regression
 * would take once trained. The weights below are set from domain reasoning
 * rather than fitted to data, because this gym has no churn history to fit to
 * yet. Swapping in fitted coefficients later means editing WEIGHTS and nothing
 * else; every factor is already normalised to 0..1.
 */

/* ─────────────────────────────── inputs ─────────────────────────────── */

export type RetentionSignals = {
  /** Days since the member last checked in. Null when they never have. */
  daysSinceLastVisit: number | null;
  /** Check-ins in the last 30 days, and the 30 days before that. */
  visitsLast30: number;
  visitsPrev30: number;
  /** What "normal" looks like for this member — from their plan, else 3. */
  targetVisitsPerWeek: number;
  /** Days until the membership lapses. Negative means already lapsed. */
  daysUntilMembershipEnds: number | null;
  /** Outstanding balance in whole pesos (Sales.amount - Sales.paid). */
  unpaidPesos: number;
  /** Plan adherence: sessions actually completed vs scheduled to date. */
  sessionsCompleted: number;
  sessionsAssigned: number;
  /**
   * Whether an ACTIVE plan exists at all. Distinct from sessionsAssigned > 0:
   * a plan generated today has nothing due yet, which is not the same thing as
   * having no plan, and the dashboard must not report it as such.
   */
  hasActivePlan: boolean;
  /** Days since joining. Guards against judging a member who just arrived. */
  tenureDays: number;
};

/* ─────────────────────────────── weights ─────────────────────────────── */

/**
 * Weights sum to 1.0, so the weighted sum is already a 0..1 risk before it is
 * scaled to 0..100. Ordered by how strongly each signal predicts a gym member
 * lapsing: absence is the clearest signal there is, and a member who has simply
 * stopped turning up is most of the way to gone regardless of anything else.
 */
export const WEIGHTS = {
  recency: 0.3,
  frequencyTrend: 0.2,
  frequencyLevel: 0.15,
  membershipExpiry: 0.15,
  planAdherence: 0.1,
  payment: 0.1,
} as const;

export type FactorKey = keyof typeof WEIGHTS;

/** Human-readable labels, used verbatim in the dashboard and the explanation. */
const LABELS: Record<FactorKey, string> = {
  recency: "Time since last visit",
  frequencyTrend: "Visit frequency trend",
  frequencyLevel: "Visits vs. their target",
  membershipExpiry: "Membership expiry",
  planAdherence: "Workout plan adherence",
  payment: "Outstanding balance",
};

/**
 * Past this many days without a visit, recency is contributing its full weight.
 * A month is the point where a lapsed gym habit rarely restarts on its own.
 */
const RECENCY_CEILING_DAYS = 30;

/** Inside this window a membership counts as expiring soon. */
const EXPIRY_HORIZON_DAYS = 30;

/**
 * A member younger than this has not had time to establish a pattern, so their
 * score is damped toward zero rather than reported as a confident risk. Without
 * this, everyone who joined yesterday reads as CRITICAL — they have no visits,
 * no completed sessions, and no history to trend against.
 */
const GRACE_PERIOD_DAYS = 14;

/* ─────────────────────────────── outputs ─────────────────────────────── */

export type ScoredFactor = {
  key: FactorKey;
  label: string;
  /** The underlying observation, for display: "22 days", "0 of 12 sessions". */
  detail: string;
  /** 0..1, where 1 is the worst case for this factor. */
  normalised: number;
  weight: number;
  /** normalised x weight x 100 — this factor's points of the final score. */
  contribution: number;
};

export type RetentionResult = {
  /** 0 = certain to stay, 100 = certain to churn. */
  riskScore: number;
  riskLevel: RiskLevel;
  factors: ScoredFactor[];
  /** One line naming the two factors that drove the score. */
  explanation: string;
  /** True when the grace period damped the score. Shown as "new member". */
  damped: boolean;
};

/* ─────────────────────────────── helpers ─────────────────────────────── */

/** Clamps to 0..1. Every factor function ends with this. */
function unit(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * Thresholds are quartiles of the 0..100 range. Round numbers are a feature:
 * staff have to act on these, and "50 or above needs a call" is a rule someone
 * can remember without looking it up.
 */
export function levelFor(score: number): RiskLevel {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MEDIUM";
  return "LOW";
}

/* ───────────────────────────── the factors ───────────────────────────── */

function scoreRecency(s: RetentionSignals): { n: number; detail: string } {
  if (s.daysSinceLastVisit === null) {
    // Never checked in. Judge by how long they have been a member without
    // doing so — a week-old member is unremarkable, a year-old one is gone.
    return {
      n: unit(s.tenureDays / RECENCY_CEILING_DAYS),
      detail: "never checked in",
    };
  }
  return {
    n: unit(s.daysSinceLastVisit / RECENCY_CEILING_DAYS),
    detail: `${s.daysSinceLastVisit} day${s.daysSinceLastVisit === 1 ? "" : "s"} ago`,
  };
}

function scoreFrequencyTrend(s: RetentionSignals): { n: number; detail: string } {
  if (s.visitsPrev30 === 0) {
    // Nothing in either window is not missing data — it is sustained absence,
    // and it must score worse than a member who merely tailed off. Guarding on
    // tenure matters: for someone who joined five weeks ago the earlier window
    // predates their membership, so there is genuinely nothing to compare.
    if (s.visitsLast30 === 0) {
      return s.tenureDays >= 60
        ? { n: 1, detail: "no visits in 60 days" }
        : { n: 0, detail: "too new to show a trend" };
    }
    // Came back after a blank month — that is recovery, not risk.
    return { n: 0, detail: `returning (0 → ${s.visitsLast30})` };
  }
  const drop = (s.visitsPrev30 - s.visitsLast30) / s.visitsPrev30;
  const pct = Math.round(Math.abs(drop) * 100);
  return {
    n: unit(drop),
    detail:
      drop > 0
        ? `down ${pct}% (${s.visitsPrev30} → ${s.visitsLast30})`
        : `steady or up (${s.visitsPrev30} → ${s.visitsLast30})`,
  };
}

function scoreFrequencyLevel(s: RetentionSignals): { n: number; detail: string } {
  // 30 days is ~4.3 weeks. Using the member's own target rather than a fixed
  // number means a 2-day-a-week member is not marked down for not training 5.
  const expected = Math.max(1, s.targetVisitsPerWeek * (30 / 7));
  const shortfall = (expected - s.visitsLast30) / expected;
  return {
    n: unit(shortfall),
    detail: `${s.visitsLast30} of ~${Math.round(expected)} expected`,
  };
}

function scoreMembershipExpiry(s: RetentionSignals): { n: number; detail: string } {
  if (s.daysUntilMembershipEnds === null) {
    return { n: 0, detail: "no active membership record" };
  }
  const d = s.daysUntilMembershipEnds;
  if (d < 0) return { n: 1, detail: `expired ${Math.abs(d)} days ago` };
  if (d >= EXPIRY_HORIZON_DAYS) return { n: 0, detail: `${d} days remaining` };
  // Inside the horizon, risk ramps up as the end date approaches.
  return {
    n: unit((EXPIRY_HORIZON_DAYS - d) / EXPIRY_HORIZON_DAYS),
    detail: `expires in ${d} day${d === 1 ? "" : "s"}`,
  };
}

function scorePlanAdherence(s: RetentionSignals): { n: number; detail: string } {
  if (!s.hasActivePlan) {
    return { n: 0, detail: "no plan assigned" };
  }
  // A plan exists but its first week has not elapsed. Nothing is owed yet, so
  // there is no adherence to judge — reporting 0/0 as a failure would punish a
  // member for a plan they were given this morning.
  if (s.sessionsAssigned === 0) {
    return { n: 0, detail: "plan just started — nothing due yet" };
  }
  const rate = s.sessionsCompleted / s.sessionsAssigned;
  return {
    n: unit(1 - rate),
    detail: `${s.sessionsCompleted} of ${s.sessionsAssigned} sessions logged`,
  };
}

function scorePayment(s: RetentionSignals): { n: number; detail: string } {
  if (s.unpaidPesos <= 0) return { n: 0, detail: "paid up" };
  // Any arrears is a signal; ₱5,000 outstanding is treated as the worst case.
  // A balance is a weak churn predictor on its own, which is why this carries
  // the smallest weight — plenty of committed members pay late.
  return {
    n: unit(s.unpaidPesos / 5000),
    detail: `₱${s.unpaidPesos.toLocaleString()} outstanding`,
  };
}

const FACTOR_FNS: Record<FactorKey, (s: RetentionSignals) => { n: number; detail: string }> = {
  recency: scoreRecency,
  frequencyTrend: scoreFrequencyTrend,
  frequencyLevel: scoreFrequencyLevel,
  membershipExpiry: scoreMembershipExpiry,
  planAdherence: scorePlanAdherence,
  payment: scorePayment,
};

/* ─────────────────────────────── scoring ─────────────────────────────── */

/**
 * Scores one member. Pure — no database, no network, no clock. Everything it
 * needs is in `signals`, which is what makes it unit-testable and what lets the
 * same function run in a nightly job and in a "what if" tool.
 */
export function scoreRetention(signals: RetentionSignals): RetentionResult {
  const factors: ScoredFactor[] = (Object.keys(WEIGHTS) as FactorKey[]).map((key) => {
    const { n, detail } = FACTOR_FNS[key](signals);
    const weight = WEIGHTS[key];
    return {
      key,
      label: LABELS[key],
      detail,
      normalised: Number(n.toFixed(3)),
      weight,
      contribution: Number((n * weight * 100).toFixed(1)),
    };
  });

  const raw = factors.reduce((sum, f) => sum + f.contribution, 0);

  // New members are damped toward 0: they have no history, and flagging them
  // as high risk on day two would train staff to ignore the whole dashboard.
  const damped = signals.tenureDays < GRACE_PERIOD_DAYS;
  const scale = damped ? signals.tenureDays / GRACE_PERIOD_DAYS : 1;
  const riskScore = Math.round(Math.min(100, Math.max(0, raw * scale)));

  return {
    riskScore,
    riskLevel: levelFor(riskScore),
    factors,
    explanation: explain(riskScore, factors, damped),
    damped,
  };
}

/**
 * A single sentence naming what actually drove the number.
 *
 * Written from the factor table rather than generated, so it can never say
 * something the score does not support.
 */
function explain(score: number, factors: ScoredFactor[], damped: boolean): string {
  const ranked = [...factors].filter((f) => f.contribution > 0).sort((a, b) => b.contribution - a.contribution);

  if (ranked.length === 0) {
    return "No risk signals — attending regularly, paid up, membership current.";
  }

  const top = ranked.slice(0, 2).map((f) => `${f.label.toLowerCase()} (${f.detail})`);
  const lead =
    score >= 75 ? "Critical risk" : score >= 50 ? "High risk" : score >= 25 ? "Some risk" : "Low risk";

  const body = top.length === 2 ? `${top[0]} and ${top[1]}` : top[0];
  const suffix = damped ? " Score damped — member joined recently." : "";

  return `${lead}, driven by ${body}.${suffix}`;
}
