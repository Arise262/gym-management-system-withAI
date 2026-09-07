"use server";

import { revalidatePath } from "next/cache";
import type { RiskLevel } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { recomputeRetentionScores } from "@/analytics/recompute";
import type { ScoredFactor } from "@/analytics/retention";

export type RecomputeResult =
  | { success: true; scored: number; byLevel: Record<RiskLevel, number> }
  | { success: false; error: string };

/**
 * Recomputes retention risk for every member.
 *
 * Cheap enough to run on demand from the dashboard: it is arithmetic over five
 * queries, with no model call anywhere in the path. The nightly cron
 * (/api/cron/daily) runs the same recomputeRetentionScores() and then raises
 * RETENTION_ALERT notifications for anyone HIGH or CRITICAL.
 */
export async function RecomputeRetentionScores(): Promise<RecomputeResult> {
  // ADMIN only, matching middleware.ts: /retention is not a /member or /trainer
  // path, so default-deny already makes the page admin-only. Guarding the
  // action with TRAINER instead would let a trainer POST for data they cannot
  // open in the UI. If trainers should see this later, add the route first.
  await requireRole("ADMIN");

  try {
    const { scored, byLevel } = await recomputeRetentionScores(new Date());
    revalidatePath("/retention");
    return { success: true, scored, byLevel };
  } catch (e) {
    console.error("RecomputeRetentionScores failed:", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "Could not recompute retention scores.",
    };
  }
}

export type RetentionRow = {
  memberId: string;
  memberCode: string;
  name: string;
  riskScore: number;
  riskLevel: RiskLevel;
  explanation: string | null;
  factors: ScoredFactor[];
  scoreDate: string;
};

export type RetentionOverview = {
  rows: RetentionRow[];
  byLevel: Record<RiskLevel, number>;
  /** Null when the job has never been run. */
  lastRun: string | null;
};

/**
 * The current picture: every member's most recent score, worst first.
 *
 * Reads only the stored scores — it never recomputes. Staff opening the page
 * should see the same numbers they were shown when the job last ran, not a
 * silently different set because a check-in landed in between.
 */
export async function getRetentionOverview(): Promise<RetentionOverview> {
  await requireRole("ADMIN"); // see RecomputeRetentionScores

  const latest = await prisma.retentionScore.findMany({
    orderBy: [{ scoreDate: "desc" }, { riskScore: "desc" }],
    include: {
      member: { select: { id: true, name: true, memberCode: true } },
    },
  });

  // One row per member — the newest, since the query is date-descending.
  const seen = new Set<string>();
  const rows: RetentionRow[] = [];
  const byLevel: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  let lastRun: Date | null = null;

  for (const r of latest) {
    if (seen.has(r.memberId)) continue;
    seen.add(r.memberId);
    if (!lastRun || r.scoreDate > lastRun) lastRun = r.scoreDate;

    byLevel[r.riskLevel] += 1;
    rows.push({
      memberId: r.memberId,
      memberCode: r.member.memberCode,
      name: r.member.name,
      riskScore: r.riskScore,
      riskLevel: r.riskLevel,
      explanation: r.explanation,
      factors: (r.factors as unknown as ScoredFactor[]) ?? [],
      scoreDate: r.scoreDate.toISOString(),
    });
  }

  rows.sort((a, b) => b.riskScore - a.riskScore);

  return { rows, byLevel, lastRun: lastRun ? lastRun.toISOString() : null };
}

/** One member's score history, newest first. Feeds the member detail page. */
export async function getMemberRetentionHistory(
  memberId: string,
  limit = 30
): Promise<RetentionRow[]> {
  await requireRole("ADMIN"); // see RecomputeRetentionScores

  const rows = await prisma.retentionScore.findMany({
    where: { memberId },
    orderBy: { scoreDate: "desc" },
    take: limit,
    include: { member: { select: { name: true, memberCode: true } } },
  });

  return rows.map((r) => ({
    memberId: r.memberId,
    memberCode: r.member.memberCode,
    name: r.member.name,
    riskScore: r.riskScore,
    riskLevel: r.riskLevel,
    explanation: r.explanation,
    factors: (r.factors as unknown as ScoredFactor[]) ?? [],
    scoreDate: r.scoreDate.toISOString(),
  }));
}
