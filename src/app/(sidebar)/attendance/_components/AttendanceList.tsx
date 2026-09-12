"use client";

import { useState } from "react";
import { IconTrash } from "@tabler/icons-react";
import { toast } from "sonner";
import type { Coverage } from "@/action/attendance.action";
import { DeleteWalkIn, SetWalkInPaid, type WalkInRow } from "@/action/walk-in.action";
import { EmptyState } from "@/components/empty-state";
import { PaidBadge, PassBadge } from "@/components/paid-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatAppDate, formatClock, pesos } from "@/lib/format";
import { WALK_IN_RATES } from "@/lib/walk-in";

export type MemberCheckIn = {
  id: string;
  time: string;
  member: { id: string; name: string };
  coverage: Coverage;
};

type Entry =
  | { kind: "member"; id: string; name: string; time: string; coverage: Coverage }
  | ({ kind: "walkin" } & WalkInRow);

const AMBER_BADGE = "bg-amber-400 text-black hover:bg-amber-400";

/** What a walk-in row says under the name. */
function walkInDetail(w: WalkInRow): string {
  if (w.pass) return `Walk-in · on weekly pass until ${formatAppDate(w.pass.validUntil) ?? "—"}`;
  if (w.rate === "WEEKLY") return `Walk-in · bought weekly pass · ${pesos(w.amount)} · until ${formatAppDate(w.validUntil) ?? "—"}`;
  return `Walk-in · ${WALK_IN_RATES[w.rate].label} · ${pesos(w.amount)}`;
}

function memberDetail(c: Coverage): string {
  if (!c) return "Member · no plan covers this day";
  return `Member · plan runs until ${formatAppDate(c.until) ?? c.until}${c.due > 0 ? ` · ${pesos(c.due)} still owed` : ""}`;
}

/**
 * One day's attendance: members and walk-ins in a single list by time, so the
 * desk sees everyone who came in, not two lists to reconcile.
 *
 * Every row answers "has this person paid for today?": a walk-in's own
 * Paid/Unpaid, a visit covered by a weekly pass, or a member whose membership
 * (weekly or monthly) runs through the day.
 */
export function AttendanceList({
  checkIns,
  walkIns,
  onWalkInChange,
  onWalkInRemoved,
  emptyTitle = "No one has checked in yet",
}: {
  checkIns: MemberCheckIn[];
  walkIns: WalkInRow[];
  onWalkInChange: (walkIn: WalkInRow) => void;
  onWalkInRemoved: (id: string) => void;
  emptyTitle?: string;
}) {
  const [busy, setBusy] = useState<string>();

  const entries: Entry[] = [
    ...checkIns.map((a) => ({ kind: "member" as const, id: a.id, name: a.member.name, time: a.time, coverage: a.coverage })),
    ...walkIns.map((w) => ({ kind: "walkin" as const, ...w })),
  ].sort((a, b) => b.time.localeCompare(a.time));

  // Covered visits cost nothing, so they are neither paid nor owed.
  const charged = walkIns.filter((w) => !w.pass);
  const paidCash = charged.filter((w) => w.paidAt).reduce((s, w) => s + w.amount, 0);
  const unpaid = charged.filter((w) => !w.paidAt);

  async function togglePaid(w: WalkInRow) {
    setBusy(w.id);
    const res = await SetWalkInPaid(w.id, !w.paidAt);
    setBusy(undefined);
    if (!res.success) return toast.error(res.error);
    toast.success(res.message);
    onWalkInChange(res.walkIn);
  }

  async function remove(w: WalkInRow) {
    setBusy(w.id);
    try {
      const res = await DeleteWalkIn(w.id);
      if (!res.success) return toast.error(res.error);
      toast.success(`Removed ${w.name}`);
      onWalkInRemoved(w.id);
    } catch {
      toast.error("Could not remove that walk-in.");
    } finally {
      setBusy(undefined);
    }
  }

  if (entries.length === 0) {
    return <EmptyState title={emptyTitle} description="Members and walk-ins you check in appear here." />;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        {checkIns.length} {checkIns.length === 1 ? "member" : "members"} · {walkIns.length}{" "}
        {walkIns.length === 1 ? "walk-in" : "walk-ins"}
        {walkIns.length > 0 && (
          <>
            {" "}· <span className="text-foreground font-medium">{pesos(paidCash)}</span> walk-in cash
            {unpaid.length > 0 && (
              <span className="text-amber-700 dark:text-amber-400">
                {" "}· {pesos(unpaid.reduce((s, w) => s + w.amount, 0))} unpaid ({unpaid.length})
              </span>
            )}
          </>
        )}
      </p>

      <ol className="divide-border/70 divide-y">
        {entries.map((e, i) => (
          <li key={`${e.kind}-${e.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
            <span className="text-muted-foreground w-6 text-right text-sm tabular-nums">{entries.length - i}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{e.name}</p>
              <p className="text-muted-foreground text-xs">
                {e.kind === "member" ? memberDetail(e.coverage) : walkInDetail(e)}
                {" · "}
                {formatClock(e.time)}
              </p>
            </div>

            {e.kind === "member" ? (
              !e.coverage ? (
                <Badge className={AMBER_BADGE}>No active plan</Badge>
              ) : e.coverage.due > 0 ? (
                <Badge className={AMBER_BADGE}>Balance due</Badge>
              ) : (
                <PassBadge label="Covered" />
              )
            ) : (
              <div className="flex items-center gap-2">
                {e.pass ? (
                  <>
                    <PassBadge />
                    {!e.pass.paid && <span className="text-xs text-amber-700 dark:text-amber-400">pass unpaid</span>}
                  </>
                ) : (
                  <>
                    <PaidBadge paid={e.paidAt !== null} />
                    <Button size="sm" variant={e.paidAt ? "ghost" : "outline"} disabled={busy === e.id} onClick={() => togglePaid(e)}>
                      {e.paidAt ? "Undo" : "Mark paid"}
                    </Button>
                  </>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="size-8" disabled={busy === e.id} aria-label={`Remove ${e.name}`}>
                      <IconTrash className="size-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove {e.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        For a walk-in recorded by mistake.
                        {e.paidAt && e.amount > 0 ? ` Their ${pesos(e.amount)} will drop out of that day's cash total.` : ""}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep</AlertDialogCancel>
                      <AlertDialogAction onClick={() => remove(e)}>Remove</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
