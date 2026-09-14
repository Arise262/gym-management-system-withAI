"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/form-field";
import { cn } from "@/lib/utils";
import { StartNutritionPlan, type ActionResult } from "@/action/nutrition.action";
import {
  ACTIVITY_LEVELS,
  PHASE_BLURB,
  PHASE_LABEL,
  dailyTargets,
  type ActivityLevel,
  type Phase,
  type Sex,
} from "@/lib/nutrition";

const PHASES: Phase[] = ["CUT", "MAINTAIN", "BULK"];

/**
 * Choosing a nutrition phase and confirming the numbers it is calculated from.
 *
 * Weight, height and activity are prefilled from the profile and the latest
 * weigh-in, but asked again: the targets are only as good as these, and a
 * profile filled in months ago is often out of date.
 *
 * The calorie preview under the phase cards is computed here in the browser
 * with the same function the server uses, so the member sees the effect of
 * each choice before committing to it.
 */
export function NutritionSetupForm({
  defaults,
  age,
  sex,
  experienceLevel,
  cutBlocked,
  currentPhase,
  onDone,
}: {
  defaults: {
    weightKg: number | null;
    heightCm: number | null;
    activityLevel: ActivityLevel | null;
    targetWeightKg: number | null;
  };
  age: number;
  sex: Sex;
  experienceLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  cutBlocked: string | null;
  /** Set when changing an existing plan. */
  currentPhase?: Phase;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    StartNutritionPlan,
    null
  );

  const [phase, setPhase] = useState<Phase | "">(currentPhase ?? "");
  const [weight, setWeight] = useState(defaults.weightKg ? String(defaults.weightKg) : "");
  const [height, setHeight] = useState(defaults.heightCm ? String(defaults.heightCm) : "");
  const [activity, setActivity] = useState<ActivityLevel | "">(defaults.activityLevel ?? "");
  const [target, setTarget] = useState(defaults.targetWeightKg ? String(defaults.targetWeightKg) : "");

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      toast.success("Your nutrition targets are ready.");
      onDone?.();
      router.refresh();
    } else {
      toast.error(state.error);
    }
  }, [state, router, onDone]);

  const preview = useMemo(() => {
    const w = Number(weight);
    const h = Number(height);
    if (!phase || !activity || !(w >= 25 && w <= 400) || !(h >= 80 && h <= 250)) return null;
    return dailyTargets(
      { weightKg: w, heightCm: h, age, sex, activityLevel: activity, targetWeightKg: Number(target) || null, experienceLevel },
      phase
    );
  }, [phase, weight, height, activity, target, age, sex, experienceLevel]);

  const needsTarget = phase === "CUT" || phase === "BULK";

  // Mirrors the server's check, so the member sees it before submitting.
  const w = Number(weight);
  const t = Number(target);
  const directionProblem =
    needsTarget && w > 0 && t > 0
      ? phase === "CUT" && t >= w
        ? "A cut needs a target below your current weight. If you want to gain, choose Bulk."
        : phase === "BULK" && t <= w
          ? "A bulk needs a target above your current weight. If you want to lose, choose Cut."
          : null
      : null;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          What are you doing with your eating right now?
          <span aria-hidden="true" className="text-destructive"> *</span>
        </legend>
        <RadioGroup
          value={phase}
          onValueChange={(v) => setPhase(v as Phase)}
          className="grid gap-3 sm:grid-cols-3"
        >
          {PHASES.map((p) => {
            const disabled = p === "CUT" && Boolean(cutBlocked);
            return (
              <Label
                key={p}
                className={cn(
                  "flex cursor-pointer flex-col items-start gap-1 rounded-lg border p-3 font-normal transition-colors",
                  "has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5",
                  disabled && "cursor-not-allowed opacity-50"
                )}
              >
                <span className="flex items-center gap-2 text-base font-semibold">
                  <RadioGroupItem value={p} disabled={disabled} />
                  {PHASE_LABEL[p]}
                </span>
                <span className="text-muted-foreground text-sm leading-snug">
                  {disabled ? cutBlocked : PHASE_BLURB[p]}
                </span>
              </Label>
            );
          })}
        </RadioGroup>
        <input type="hidden" name="phase" value={phase} />
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your weight today (kg)" required hint="Weigh yourself in the morning, before eating.">
          {(p) => (
            <Input {...p} name="weightKg" type="number" inputMode="decimal" step="0.1" min={25} max={400}
              value={weight} onChange={(e) => setWeight(e.target.value)} />
          )}
        </Field>
        <Field label="Height (cm)" required>
          {(p) => (
            <Input {...p} name="heightCm" type="number" inputMode="numeric" min={80} max={250}
              value={height} onChange={(e) => setHeight(e.target.value)} />
          )}
        </Field>
      </div>

      <Field label="How active are you?" required hint="Count your gym sessions and your job — a physical job counts.">
        {(p) => (
          <Select value={activity} onValueChange={(v) => setActivity(v as ActivityLevel)}>
            <SelectTrigger id={p.id} aria-describedby={p["aria-describedby"]} className="w-full">
              <SelectValue placeholder="Choose one" />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_LEVELS.map((a) => (
                <SelectItem key={a.level} value={a.level}>{a.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
      <input type="hidden" name="activityLevel" value={activity} />

      {needsTarget && (
        <Field
          label="Target weight (kg)"
          required
          hint="Where you want to end up. We use it to predict when you'll get there."
          error={directionProblem ?? undefined}
        >
          {(p) => (
            <Input {...p} name="targetWeightKg" type="number" inputMode="numeric" min={25} max={400}
              value={target} onChange={(e) => setTarget(e.target.value)} />
          )}
        </Field>
      )}

      {preview && (
        <p className="bg-muted rounded-md px-3 py-2 text-sm" aria-live="polite">
          That works out to about{" "}
          <span className="font-semibold">{preview.calories.toLocaleString()} kcal a day</span>, with{" "}
          <span className="font-semibold">{preview.proteinG} g protein</span>.
        </p>
      )}

      {state && !state.success && (
        <p role="alert" className="text-destructive text-sm">{state.error}</p>
      )}

      <Button type="submit" disabled={pending || !phase || Boolean(directionProblem)} className="w-fit">
        {pending ? "Calculating…" : currentPhase ? "Recalculate my targets" : "Get my targets"}
      </Button>
    </form>
  );
}
