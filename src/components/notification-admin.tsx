"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { NotificationType } from "@prisma/client";
import { IconCheck, IconPlayerPlay, IconX } from "@tabler/icons-react";
import {
  RunDailyJobNow,
  type NotificationOverview,
  type RunNowResult,
} from "@/action/notification.action";
import type { DailyRunReport } from "@/notifications/daily";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { timeAgo } from "@/components/notification-list";

/**
 * Admin view of the notification system: is it wired up, when did the daily
 * job last run, what went out this week, and a button to run the job now.
 */

const TYPE_LABEL: Record<NotificationType, string> = {
  WORKOUT_REMINDER: "Workout reminder",
  MEMBERSHIP_RENEWAL: "Membership renewal",
  PROGRESS_UPDATE: "Progress update",
  MOTIVATIONAL: "Motivational",
  TRAINER_ANNOUNCEMENT: "Announcement",
  BOOKING_CONFIRMED: "Booking confirmed",
  BOOKING_REQUESTED: "Booking requested",
  BOOKING_CANCELLED: "Booking cancelled",
  PAYMENT_RECEIVED: "Payment received",
  RETENTION_ALERT: "Retention alert",
};

function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? <IconCheck className="size-4 text-emerald-600" /> : <IconX className="size-4 text-red-600" />}
      <span>{label}</span>
    </div>
  );
}

function ReportSummary({ r }: { r: DailyRunReport }) {
  const rows: Array<[string, string]> = [
    ["Gym date", `${r.gymDate} (${r.weekKey})`],
    ["Renewal reminders", `${r.renewals.notified} sent of ${r.renewals.candidates} expiring`],
    ["Workout reminders", `${r.workoutReminders.notified} sent of ${r.workoutReminders.candidates} idle`],
    [
      "Retention",
      `${r.retention.scored} scored, ${r.retention.atRisk} at risk → ${r.retention.adminAlerts} admin alerts, ${r.retention.nudges} member nudges`,
    ],
    ["Progress updates", r.progress.ran ? `${r.progress.notified} sent` : "skipped (not Monday)"],
    ["Engagement metrics", `${r.engagement.rows} rows over ${r.engagement.weeks} weeks for ${r.engagement.members} members`],
    ["Email retry", `${r.emailRetry.sent} of ${r.emailRetry.attempted} resent`],
    ["Duration", `${r.durationMs} ms`],
  ];
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
      {rows.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="tabular-nums">{v}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

export function NotificationAdmin({ overview }: { overview: NotificationOverview }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [result, setResult] = React.useState<RunNowResult | null>(null);

  function run(forceWeekly: boolean) {
    setResult(null);
    startTransition(async () => {
      const r = await RunDailyJobNow(forceWeekly);
      setResult(r);
      if (r.success) router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily job</CardTitle>
            <CardDescription>
              Renewal warnings, workout reminders, retention scoring and weekly progress. Runs every morning from
              cron-job.org against <code className="text-xs">/api/cron/daily</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Status ok={overview.cronConfigured} label={overview.cronConfigured ? "CRON_SECRET is set" : "CRON_SECRET is missing — the endpoint refuses every call"} />
            <Status ok={overview.mailConfigured} label={overview.mailConfigured ? "Brevo email is configured" : "Email not configured — notifications are in-app only"} />
            <p className="text-sm">
              Last run:{" "}
              <span className="font-medium">
                {overview.lastDailyRun ? timeAgo(overview.lastDailyRun) : "never"}
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => run(false)} disabled={pending}>
                <IconPlayerPlay className="mr-1 size-4" />
                {pending ? "Running…" : "Run now"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => run(true)} disabled={pending}>
                Run with weekly progress
              </Button>
            </div>
            {result && !result.success && <p className="text-sm text-red-600">{result.error}</p>}
            {result?.success && <ReportSummary r={result.report} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Last 7 days</CardTitle>
            <CardDescription>What the system sent, by type.</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.last7Days.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nothing sent yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Created</TableHead>
                    <TableHead className="text-right">Emailed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.last7Days.map((r) => (
                    <TableRow key={r.type}>
                      <TableCell>{TYPE_LABEL[r.type]}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.count}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.emailed}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent notifications</CardTitle>
          <CardDescription>The 30 most recent, across every account.</CardDescription>
        </CardHeader>
        <CardContent>
          {overview.recent.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nothing yet. Press “Run now” to generate the first batch.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.recent.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{timeAgo(n.createdAt)}</TableCell>
                      <TableCell className="whitespace-nowrap">{n.recipient}</TableCell>
                      <TableCell className="whitespace-nowrap">{TYPE_LABEL[n.type]}</TableCell>
                      <TableCell className="max-w-[28rem] truncate">{n.title}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className="flex gap-1">
                          <Badge variant={n.readAt ? "secondary" : "default"}>{n.readAt ? "read" : "unread"}</Badge>
                          {n.channel !== "IN_APP" && (
                            <Badge variant={n.sentAt ? "secondary" : "outline"}>{n.sentAt ? "emailed" : "email pending"}</Badge>
                          )}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
