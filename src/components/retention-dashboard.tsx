"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { RiskLevel } from "@prisma/client";
import { IconChevronDown, IconRefresh } from "@tabler/icons-react";
import { RecomputeRetentionScores, type RetentionOverview, type RetentionRow } from "@/action/retention.action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/**
 * Retention dashboard.
 *
 * The design goal is that a member of staff can answer "why is this person at
 * risk" without asking anyone. Every row expands into the exact factor table
 * the score was computed from — the same numbers, not a summary of them.
 */

const LEVEL_ORDER: RiskLevel[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

const LEVEL_STYLES: Record<RiskLevel, string> = {
  CRITICAL: "bg-red-600 text-white hover:bg-red-600",
  HIGH: "bg-orange-500 text-white hover:bg-orange-500",
  MEDIUM: "bg-amber-400 text-black hover:bg-amber-400",
  LOW: "bg-emerald-600 text-white hover:bg-emerald-600",
};

const LEVEL_HINT: Record<RiskLevel, string> = {
  CRITICAL: "Call today",
  HIGH: "Reach out this week",
  MEDIUM: "Keep an eye on",
  LOW: "No action needed",
};

function formatDate(iso: string | null): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function RetentionDashboard({ overview }: { overview: RetentionOverview }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  function recompute() {
    setError(null);
    startTransition(async () => {
      const result = await RecomputeRetentionScores();
      if (!result.success) setError(result.error);
      else router.refresh();
    });
  }

  const { rows, byLevel, lastRun } = overview;

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Member retention</h1>
          <p className="text-muted-foreground text-sm">
            Churn risk scored from attendance, membership, plan adherence and payments.
            Last calculated {formatDate(lastRun)}.
          </p>
        </div>
        <Button onClick={recompute} disabled={pending}>
          <IconRefresh className={pending ? "animate-spin" : ""} />
          {pending ? "Calculating…" : "Recalculate"}
        </Button>
      </div>

      {error && (
        <div className="border-destructive/50 text-destructive rounded-md border px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {LEVEL_ORDER.map((level) => (
          <Card key={level}>
            <CardHeader className="pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                {level.charAt(0) + level.slice(1).toLowerCase()} risk
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums">{byLevel[level]}</div>
              <p className="text-muted-foreground mt-1 text-xs">{LEVEL_HINT[level]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="px-0">
          {rows.length === 0 ? (
            <p className="text-muted-foreground px-6 py-10 text-center text-sm">
              No scores yet. Press <span className="font-medium">Recalculate</span> to score
              every member.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Risk</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead className="w-[110px]">Level</TableHead>
                  <TableHead>Why</TableHead>
                  <TableHead className="w-[40px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <React.Fragment key={row.memberId}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => setExpanded(expanded === row.memberId ? null : row.memberId)}
                    >
                      <TableCell className="text-lg font-semibold tabular-nums">
                        {row.riskScore}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/members/${row.memberId}`}
                          className="font-medium hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {row.name}
                        </Link>
                        <div className="text-muted-foreground text-xs">{row.memberCode}</div>
                      </TableCell>
                      <TableCell>
                        <Badge className={LEVEL_STYLES[row.riskLevel]}>{row.riskLevel}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[420px] text-sm">
                        {row.explanation}
                      </TableCell>
                      <TableCell>
                        <IconChevronDown
                          size={16}
                          className={`transition-transform ${
                            expanded === row.memberId ? "rotate-180" : ""
                          }`}
                        />
                      </TableCell>
                    </TableRow>

                    {expanded === row.memberId && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={5} className="bg-muted/40 p-0">
                          <FactorBreakdown row={row} />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * The score, taken apart.
 *
 * Shows each factor's observation, its weight, and the points it contributed,
 * so the total is visibly the sum of its parts rather than a claim.
 */
function FactorBreakdown({ row }: { row: RetentionRow }) {
  const total = row.factors.reduce((sum, f) => sum + f.contribution, 0);

  return (
    <div className="px-6 py-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted-foreground text-left text-xs uppercase tracking-wide">
            <th className="pb-2 font-medium">Factor</th>
            <th className="pb-2 font-medium">Observed</th>
            <th className="pb-2 font-medium">Weight</th>
            <th className="pb-2 text-right font-medium">Points</th>
          </tr>
        </thead>
        <tbody>
          {row.factors.map((f) => (
            <tr key={f.key} className="border-t">
              <td className="py-2 pr-4">{f.label}</td>
              <td className="text-muted-foreground py-2 pr-4">{f.detail}</td>
              <td className="text-muted-foreground py-2 pr-4 tabular-nums">
                {(f.weight * 100).toFixed(0)}%
              </td>
              <td className="py-2 text-right">
                <div className="flex items-center justify-end gap-2">
                  <div className="bg-muted h-1.5 w-24 overflow-hidden rounded-full">
                    <div
                      className="bg-foreground/60 h-full rounded-full"
                      style={{ width: `${(f.normalised * 100).toFixed(0)}%` }}
                    />
                  </div>
                  <span className="w-10 tabular-nums">{f.contribution.toFixed(1)}</span>
                </div>
              </td>
            </tr>
          ))}
          <tr className="border-t font-medium">
            <td className="py-2" colSpan={3}>
              Total risk score
            </td>
            <td className="py-2 text-right tabular-nums">
              {total.toFixed(1)}
              {Math.round(total) !== row.riskScore && (
                <span className="text-muted-foreground ml-2 text-xs font-normal">
                  → {row.riskScore} after new-member damping
                </span>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
