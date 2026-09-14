import Link from "next/link";
import { addWeeks, format } from "date-fns";
import {
  IconCircleCheck,
  IconClockHour4,
  IconArrowsDiff,
  IconAlertTriangle,
} from "@tabler/icons-react";
import type { NutritionView } from "@/lib/nutrition-view";
import { PredictionChart } from "@/components/dashboard-charts";
import { WeighInForm } from "@/components/weigh-in-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAppDate } from "@/lib/format";
import { parseGymDate } from "@/analytics/signals";
import { PHASE_LABEL } from "@/lib/nutrition";
import type { TrackStatus } from "@/lib/nutrition-projection";

/** Muscle estimates assume the member is actually training. Below this plan adherence, they are withheld. */
const MIN_ADHERENCE_FOR_MUSCLE = 50;

const DAY_MS = 86_400_000;

function signed(n: number): string {
  if (n === 0) return "0";
  return `${n > 0 ? "+" : "−"}${Math.abs(n)}`;
}

function range([a, b]: [number, number]): string {
  if (a === 0 && b === 0) return "held";
  if (a === b) return `${signed(a)} kg`;
  return `${signed(a)} to ${signed(b)} kg`;
}

/** Status with an icon AND words — never colour alone. */
function TrackBadge({ track, phase }: { track: TrackStatus; phase: string }) {
  if (track.status === "too-early") {
    return (
      <p className="flex items-start gap-2 text-sm">
        <IconClockHour4 className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        <span>
          <span className="font-medium">Too early to tell.</span>{" "}
          <span className="text-muted-foreground">
            Weigh in once a week — after two weeks we can show whether you&apos;re on track. Your weight swings a
            kilo or two day to day on water alone, so one weigh-in says little.
          </span>
        </span>
      </p>
    );
  }
  const rates = `You're averaging ${signed(track.actualPerWeek)} kg a week; the prediction was ${signed(track.predictedPerWeek)} kg.`;

  // The advice depends on the phase: "slower" on a cut means eat less, on a
  // bulk it means eat MORE. One shared line told under-eating bulkers to cut
  // back on rice.
  const advice: Record<string, { slower: [string, string]; faster: [string, string] }> = {
    CUT: {
      slower: ["Slower than predicted.", "Check your portions — extra rice and cooking oil are the usual culprits."],
      faster: ["Faster than predicted.", "Losing too fast costs muscle — make sure you're eating your full calories and protein."],
    },
    BULK: {
      slower: ["Slower than predicted.", "You may be eating less than you think — add a cup of rice or a glass of milk a day."],
      faster: ["Faster than predicted.", "Gaining faster than planned usually means extra fat — trim the surplus a little."],
    },
    // At maintenance the "prediction" is zero, so faster = gaining, slower = losing.
    MAINTAIN: {
      slower: ["Drifting down.", "Your weight is falling while you meant to hold it — eat a little more."],
      faster: ["Creeping up.", "Your weight is rising while you meant to hold it — trim your portions a little."],
    },
  };
  const a = advice[phase] ?? advice.CUT;

  const copy = {
    "on-track": { icon: IconCircleCheck, title: "On track.", body: rates },
    slower: { icon: IconArrowsDiff, title: a.slower[0], body: `${rates} ${a.slower[1]}` },
    faster: { icon: IconArrowsDiff, title: a.faster[0], body: `${rates} ${a.faster[1]}` },
    "wrong-way": {
      icon: IconAlertTriangle,
      title: "Moving the other way.",
      body: `${rates} Recalculate your targets on the Nutrition page, or ask a trainer to look at your eating.`,
    },
  }[track.status];
  const Icon = copy.icon;
  return (
    <p className="flex items-start gap-2 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span>
        <span className="font-medium">{copy.title}</span> <span className="text-muted-foreground">{copy.body}</span>
      </span>
    </p>
  );
}

/**
 * "What will happen if I keep this up" — the predicted weight over a year,
 * the member's real weigh-ins against it, and milestones in plain dates.
 */
export function PredictionCard({
  nutrition,
  adherencePct,
}: {
  nutrition: NutritionView;
  /** Workout-plan adherence, or null when the member has no plan. */
  adherencePct: number | null;
}) {
  const plan = nutrition.plan;

  if (!plan) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Predict your progress</CardTitle>
          <CardDescription>
            {nutrition.eligibility.ok
              ? "Tell us whether you're cutting, maintaining or bulking and we'll predict where you'll be in 1, 3, 6 and 12 months — and when you'll reach your goal."
              : nutrition.eligibility.reason}
          </CardDescription>
        </CardHeader>
        {nutrition.eligibility.ok && (
          <CardContent>
            <Link href="/member/nutrition">
              <Button>Set my nutrition phase</Button>
            </Link>
          </CardContent>
        )}
      </Card>
    );
  }

  const start = parseGymDate(plan.startedOn) ?? new Date();
  const when = (week: number) => format(addWeeks(start, week), "MMMM yyyy");
  const showMuscle = adherencePct !== null && adherencePct >= MIN_ADHERENCE_FOR_MUSCLE;

  const predicted = plan.projection.points.map((p) => ({
    week: p.week,
    predicted: p.weightKg,
    band: [p.lowKg, p.highKg] as [number, number],
  }));
  const actual = nutrition.weighIns
    .map((w) => ({ day: parseGymDate(w.date), weightKg: w.weightKg }))
    .filter((w): w is { day: Date; weightKg: number } => Boolean(w.day) && w.day!.getTime() >= start.getTime())
    .map((w) => ({ week: Math.round(((w.day.getTime() - start.getTime()) / DAY_MS / 7) * 10) / 10, actual: w.weightKg }));

  const { targetWeek, firstNoticeableWeek } = plan.projection;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your prediction</CardTitle>
        <CardDescription>
          {PHASE_LABEL[plan.phase]} since {formatAppDate(plan.startedOn)}, if you hit about{" "}
          {plan.targets.calories.toLocaleString()} kcal and {plan.targets.proteinG} g protein most days.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <TrackBadge track={plan.track} phase={plan.phase} />

        {(firstNoticeableWeek || plan.targetWeightKg || plan.phase === "MAINTAIN") && (
          <ul className="flex flex-col gap-1 text-sm">
            {firstNoticeableWeek && (
              <li>
                <span className="font-medium">First 2 kg:</span>{" "}
                <span className="text-muted-foreground">
                  around week {firstNoticeableWeek} ({when(firstNoticeableWeek)}) — about when your clothes start to fit
                  differently.
                </span>
              </li>
            )}
            {targetWeek && plan.targetWeightKg && (
              <li>
                <span className="font-medium">Reach {plan.targetWeightKg} kg:</span>{" "}
                <span className="text-muted-foreground">
                  around week {targetWeek} ({when(targetWeek)}). After that the prediction assumes you switch to
                  maintaining.
                </span>
              </li>
            )}
            {!targetWeek && plan.targetWeightKg && plan.phase !== "MAINTAIN" && (
              <li>
                <span className="font-medium">Reach {plan.targetWeightKg} kg:</span>{" "}
                <span className="text-muted-foreground">
                  more than a year away at this pace — about {plan.horizons[plan.horizons.length - 1].weightKg} kg after
                  12 months. That&apos;s normal for a big goal; recalculate as you go.
                </span>
              </li>
            )}
            {plan.phase === "MAINTAIN" && (
              <li className="text-muted-foreground">
                Your weight is predicted to hold steady. The change is in what that weight is made of.
              </li>
            )}
          </ul>
        )}

        <PredictionChart predicted={predicted} actual={actual} />

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm tabular-nums">
            <caption className="sr-only">Predicted weight and body composition</caption>
            <thead className="text-muted-foreground text-xs">
              <tr>
                <th className="pr-3 pb-2 font-medium">After</th>
                <th className="pr-3 pb-2 font-medium">Weight</th>
                <th className="pr-3 pb-2 font-medium">Change</th>
                {showMuscle && <th className="pr-3 pb-2 font-medium">Muscle</th>}
                {showMuscle && <th className="pb-2 font-medium">Fat</th>}
              </tr>
            </thead>
            <tbody>
              {plan.horizons.map((h) => (
                <tr key={h.months} className="border-t">
                  <td className="py-2 pr-3">{h.months === 12 ? "1 year" : `${h.months} month${h.months > 1 ? "s" : ""}`}</td>
                  <td className="py-2 pr-3">
                    <span className="font-medium">{h.weightKg} kg</span>{" "}
                    <span className="text-muted-foreground text-xs">
                      ({h.lowKg}–{h.highKg})
                    </span>
                  </td>
                  <td className="py-2 pr-3">{signed(h.changeKg)} kg</td>
                  {showMuscle && <td className="py-2 pr-3">{range(h.leanKg)}</td>}
                  {showMuscle && <td className="py-2">{range(h.fatKg)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-muted-foreground mt-2 text-xs">
            {showMuscle
              ? "Muscle and fat are ranges for what training can produce at your experience level, not a promise."
              : adherencePct === null
                ? "Muscle and fat estimates appear once you're following a workout plan — they depend on training, not just eating."
                : `Muscle and fat estimates appear once you've completed at least ${MIN_ADHERENCE_FOR_MUSCLE}% of your planned workouts (you're at ${adherencePct}%) — they depend on training, not just eating.`}
          </p>
        </div>

        <WeighInForm loggedToday={nutrition.loggedToday} lastWeightKg={nutrition.latestWeightKg} />

        <p className="text-muted-foreground text-xs">
          Predicted from your calorie target and how your body&apos;s energy use changes as your weight does. Real
          results vary with water, sleep and how closely you stick to it. An estimate, not medical advice.
        </p>
      </CardContent>
    </Card>
  );
}
