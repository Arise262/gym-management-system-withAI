import type { Prisma, RiskLevel } from "@prisma/client";
import prisma from "@/lib/prisma";
import { gatherSignals } from "@/analytics/signals";
import { scoreRetention } from "@/analytics/retention";

/**
 * The retention job itself, with no session check.
 *
 * Two callers: the Recalculate button on the admin dashboard (which wraps this
 * in requireRole in retention.action.ts) and the daily cron (which has no
 * session and authenticates with CRON_SECRET instead). Keeping the arithmetic
 * here means both run exactly the same code, so the dashboard never disagrees
 * with what the nightly run produced.
 */

export type RecomputeSummary = {
  scored: number;
  byLevel: Record<RiskLevel, number>;
  /** Members currently HIGH or CRITICAL, for the alerting step. */
  atRisk: Array<{
    memberId: string;
    riskLevel: RiskLevel;
    riskScore: number;
    explanation: string | null;
  }>;
};

/**
 * Scores stored one row per member per day.
 *
 * `RetentionScore` is uniquely keyed on (memberId, scoreDate), so the date has
 * to be pinned to midnight rather than left at `now()` — otherwise re-running
 * the job an hour later writes a second row for the same day instead of
 * updating the first, and the history stops being a daily series.
 */
export function startOfToday(asOf: Date): Date {
  return new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
}

export async function recomputeRetentionScores(asOf = new Date()): Promise<RecomputeSummary> {
  const scoreDate = startOfToday(asOf);
  const signals = await gatherSignals(asOf);

  const byLevel: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  const atRisk: RecomputeSummary["atRisk"] = [];
  const rows: Prisma.RetentionScoreCreateManyInput[] = [];

  for (const [memberId, s] of signals) {
    const result = scoreRetention(s);
    byLevel[result.riskLevel] += 1;
    if (result.riskLevel === "HIGH" || result.riskLevel === "CRITICAL") {
      atRisk.push({
        memberId,
        riskLevel: result.riskLevel,
        riskScore: result.riskScore,
        explanation: result.explanation,
      });
    }
    rows.push({
      memberId,
      scoreDate,
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
      factors: result.factors as unknown as Prisma.InputJsonValue,
      explanation: result.explanation,
    });
  }

  // Two statements, not one upsert per member. Every round trip to the
  // Supabase pooler costs the full network latency (measured at ~1.3 s from a
  // home connection during Phase 9), so N upserts is N × latency and a gym of
  // 300 members would blow the cron's time budget. Replacing today's rows in a
  // single transaction is the same end state — one row per member per day —
  // in constant round trips, and the (memberId, scoreDate) unique still holds.
  if (rows.length > 0) {
    await prisma.$transaction([
      prisma.retentionScore.deleteMany({ where: { scoreDate } }),
      prisma.retentionScore.createMany({ data: rows }),
    ]);
  }

  return { scored: signals.size, byLevel, atRisk };
}
