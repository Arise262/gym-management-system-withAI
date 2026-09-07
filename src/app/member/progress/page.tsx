import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";
import { GetMemberProgress } from "@/action/dashboard.action";
import { StatGrid, StatTile } from "@/components/stat-tile";
import { ColumnChart, DataTableTwin, TrendChart } from "@/components/dashboard-charts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const metadata = { title: "My progress" };

/**
 * Member progress analytics. Everything is the member's own data, resolved from
 * the session inside GetMemberProgress — there is no id in the URL to tamper with.
 */
export default async function MemberProgressPage() {
  const p = await GetMemberProgress();
  const thisWeek = p.weeks[p.weeks.length - 1];
  const hasVolume = p.weeks.some((w) => w.volumeKg > 0);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <Link href="/member">
        <Button variant="ghost" size="sm" className="-ml-2">
          <IconArrowLeft className="mr-1 size-4" />
          Back
        </Button>
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">My progress</h1>
        <p className="text-muted-foreground text-sm">Built from the workouts you log and your gym check-ins.</p>
      </div>

      <StatGrid className="md:grid-cols-4">
        <StatTile label="Workouts this week" value={thisWeek.workouts} hint={`${p.totals.workouts} logged in total`} />
        <StatTile
          label="Week streak"
          value={p.streakWeeks}
          hint={p.streakWeeks === 0 ? "Log one workout to start a streak" : p.streakWeeks === 1 ? "One week and counting" : "Consecutive weeks with a workout"}
          tone={p.streakWeeks >= 3 ? "good" : undefined}
        />
        <StatTile label="Gym visits this month" value={p.attendance.thisMonth} hint={`${p.attendance.last30} in the last 30 days`} />
        <StatTile
          label="Engagement score"
          value={p.latest ? p.latest.engagementScore : "—"}
          hint={p.latest ? `Week of ${p.latest.weekLabel} · ${p.latest.consistencyRate}% plan consistency` : "Scored weekly once you start logging"}
          tone={p.latest && p.latest.engagementScore >= 70 ? "good" : undefined}
        />
      </StatGrid>

      {p.plan && (
        <Card>
          <CardHeader>
            <CardTitle>Plan adherence</CardTitle>
            <CardDescription>
              {p.plan.title} · week {p.plan.weekOf} of {p.plan.durationWeeks}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Progress value={p.plan.adherencePct} aria-label={`${p.plan.adherencePct}% of assigned workouts completed`} />
            <p className="text-sm">
              <span className="font-semibold">{p.plan.adherencePct}%</span>{" "}
              <span className="text-muted-foreground">
                — {p.plan.completed} of {p.plan.assignedSoFar} assigned workouts completed so far
              </span>
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Workouts per week</CardTitle>
          <CardDescription>Last 8 weeks, including this one.</CardDescription>
        </CardHeader>
        <CardContent>
          <ColumnChart data={p.weeks.map((w) => ({ label: w.label, value: w.workouts }))} seriesLabel="Workouts" height={200} />
          <DataTableTwin
            caption="Workouts per week"
            rows={p.weeks.map((w) => ({ week: `w/c ${w.label}`, workouts: w.workouts, volume: `${w.volumeKg.toLocaleString()} kg` }))}
            columns={[{ key: "week", label: "Week" }, { key: "workouts", label: "Workouts" }, { key: "volume", label: "Volume" }]}
          />
        </CardContent>
      </Card>

      {hasVolume && (
        <Card>
          <CardHeader>
            <CardTitle>Training volume</CardTitle>
            <CardDescription>Sets × reps × weight for every exercise you logged with a load, per week.</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart data={p.weeks.map((w) => ({ label: w.label, value: w.volumeKg }))} seriesLabel="Volume" unit="kg" area height={200} />
          </CardContent>
        </Card>
      )}

      {p.weights.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Body weight</CardTitle>
            <CardDescription>From your fitness records at the front desk.</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart data={p.weights.map((w) => ({ label: w.label, value: w.value }))} seriesLabel="Weight" unit="kg" height={200} />
            <DataTableTwin caption="Body weight" rows={p.weights} columns={[{ key: "date", label: "Date" }, { key: "value", label: "kg" }]} />
          </CardContent>
        </Card>
      )}

      {p.totals.workouts === 0 && (
        <Card>
          <CardContent className="text-muted-foreground py-6 text-sm">
            Nothing logged yet. Open your{" "}
            <Link href="/member/workout-plan" className="text-foreground underline underline-offset-2">
              workout plan
            </Link>{" "}
            and log a session — the charts fill in from there.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
