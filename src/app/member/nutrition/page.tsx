import Link from "next/link";
import { IconArrowLeft, IconSparkles, IconTrendingUp, IconAlertTriangle } from "@tabler/icons-react";
import { GetMyNutrition } from "@/action/nutrition.action";
import { StatGrid, StatTile } from "@/components/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAppDate } from "@/lib/format";
import { PHASE_LABEL } from "@/lib/nutrition";
import { GROUP_LABEL, PHASE_FOOD_TIP, foodsFor } from "@/lib/nutrition-foods";
import { NutritionSetupForm } from "./_components/NutritionSetupForm";

export const metadata = { title: "Nutrition" };

/**
 * A member's nutrition phase: daily calories and macros, and what to eat.
 *
 * Every number on this page comes from formulas (src/lib/nutrition.ts). The
 * one paragraph Claude writes explains those numbers and is checked so it
 * cannot introduce new ones. The prediction itself lives on /member/progress,
 * next to the rest of the member's progress.
 */
export default async function NutritionPage() {
  const n = await GetMyNutrition();
  const plan = n.plan;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <Link href="/member">
        <Button variant="ghost" size="sm" className="-ml-2">
          <IconArrowLeft className="mr-1 size-4" />
          Back
        </Button>
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">Nutrition</h1>
        <p className="text-muted-foreground text-sm">
          Your daily targets and what to eat, based on whether you&apos;re cutting, maintaining or bulking.
        </p>
      </div>

      {!n.eligibility.ok ? (
        <Card>
          <CardHeader>
            <CardTitle>We can&apos;t calculate targets for you here</CardTitle>
            <CardDescription>{n.eligibility.reason}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/member/trainers">
              <Button variant="secondary">Talk to a trainer</Button>
            </Link>
          </CardContent>
        </Card>
      ) : !plan ? (
        <Card>
          <CardHeader>
            <CardTitle>Set your nutrition phase</CardTitle>
            <CardDescription>
              Tell us what you&apos;re doing with your eating and we&apos;ll work out your daily calories,
              protein, carbs and fats — and predict where it takes you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NutritionSetupForm
              defaults={{
                weightKg: n.latestWeightKg,
                heightCm: n.heightCm,
                activityLevel: n.activityLevel,
                targetWeightKg: n.targetWeightKg,
              }}
              age={n.age!}
              sex={n.sex}
              experienceLevel={n.experienceLevel}
              cutBlocked={n.eligibility.cutBlocked}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>Your plan</CardTitle>
                <Badge>{PHASE_LABEL[plan.phase]}</Badge>
              </div>
              <CardDescription>
                Started {formatAppDate(plan.startedOn)} at {plan.startWeightKg} kg
                {plan.targetWeightKg ? ` · target ${plan.targetWeightKg} kg` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="leading-relaxed">{plan.summary}</p>
              {plan.summaryByAI && (
                <p className="text-muted-foreground flex items-center gap-1 text-xs">
                  <IconSparkles className="size-3.5" />
                  Written by Claude from the numbers below. The numbers themselves are calculated, not AI-generated.
                </p>
              )}
              {plan.warning && (
                <p className="flex items-start gap-2 text-sm">
                  <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
                  {plan.warning}
                </p>
              )}
              {plan.recalculate && (
                <p className="bg-muted rounded-md px-3 py-2 text-sm">
                  Your weight has moved {Math.abs(Math.round((n.latestWeightKg! - plan.startWeightKg) * 10) / 10)} kg
                  since you started, so your body now burns a different amount. Recalculate your targets below to
                  keep them accurate.
                </p>
              )}
            </CardContent>
          </Card>

          <StatGrid className="md:grid-cols-4">
            <StatTile
              label="Calories"
              value={plan.targets.calories.toLocaleString()}
              hint={`kcal a day · you burn about ${plan.targets.tdee.toLocaleString()}`}
            />
            <StatTile label="Protein" value={`${plan.targets.proteinG} g`} hint="a day — the one to hit first" />
            <StatTile label="Carbs" value={`${plan.targets.carbsG} g`} hint="a day" />
            <StatTile label="Fats" value={`${plan.targets.fatG} g`} hint="a day" />
          </StatGrid>
          {plan.targets.floorApplied && (
            <p className="text-muted-foreground text-sm">
              Your calories are held at a safe minimum, so your cut will be a little slower than a standard 20% deficit.
            </p>
          )}

          <Card>
            <CardHeader>
              <CardTitle>What to eat</CardTitle>
              <CardDescription>{PHASE_FOOD_TIP[plan.phase]}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              {Object.entries(foodsFor(plan.phase)).map(([group, foods]) => (
                <div key={group}>
                  <h3 className="mb-2 text-sm font-semibold">{GROUP_LABEL[group as keyof typeof GROUP_LABEL]}</h3>
                  <ul className="flex flex-col gap-2">
                    {foods.map((f) => (
                      <li key={f.name} className="text-sm">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className={f.goodFor.includes(plan.phase) ? "font-medium" : "text-muted-foreground"}>
                            {f.name}
                          </span>
                          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                            {f.kcal} kcal · {f.proteinG} g P
                          </span>
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {f.serving}
                          {f.note ? ` — ${f.note}` : ""}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="text-muted-foreground text-xs sm:col-span-2">
                Values are per serving from USDA food data. Cooking oil, sauces and frying add calories, so treat
                these as a guide. <span className="font-medium text-foreground">Bold</span> items suit a{" "}
                {PHASE_LABEL[plan.phase].toLowerCase()} best.
              </p>
            </CardContent>
          </Card>

          <Link href="/member/progress" className="block">
            <Button variant="outline" className="w-full">
              <IconTrendingUp className="mr-2 size-4" />
              See your prediction and log a weigh-in
            </Button>
          </Link>

          <details className="rounded-lg border p-4">
            <summary className="cursor-pointer text-sm font-medium">Change phase or recalculate</summary>
            <div className="mt-4">
              <NutritionSetupForm
                defaults={{
                  weightKg: n.latestWeightKg,
                  heightCm: n.heightCm,
                  activityLevel: n.activityLevel,
                  targetWeightKg: plan.targetWeightKg ?? n.targetWeightKg,
                }}
                age={n.age!}
                sex={n.sex}
                experienceLevel={n.experienceLevel}
                cutBlocked={n.eligibility.cutBlocked}
                currentPhase={plan.phase}
              />
            </div>
          </details>
        </>
      )}

      {n.eligibility.ok && (
        <div className="text-muted-foreground flex flex-col gap-1 text-xs">
          {n.sex === "other" && (
            <p>
              The calorie formula has separate male and female versions; we use the midpoint of the two for you.
            </p>
          )}
          {n.hasMedicalNotes && (
            <p>You noted a medical condition on your profile — check these targets with your doctor before starting.</p>
          )}
          <p>These are estimates to guide you, not medical advice.</p>
        </div>
      )}
    </div>
  );
}
