"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IconCheck, IconDeviceFloppy } from "@tabler/icons-react";
import { LogWorkoutSession } from "@/action/workout-session.action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type LogExercise = {
  id: string;
  sets: number;
  reps: string;
  restSeconds: number;
  notes: string | null;
  exercise: { id: string; name: string; equipment: string | null; primaryMuscle: string[] };
};

type ExistingLog = {
  exerciseId: string;
  setsCompleted: number;
  repsCompleted: string | null;
  weightKg: number | null;
  completed: boolean;
};

export type LogFormProps = {
  planDayId: string;
  focus: string;
  weekNumber: number;
  dayNumber: number;
  exercises: LogExercise[];
  existing: {
    durationMinutes: number | null;
    perceivedExertion: number | null;
    notes: string | null;
    logs: ExistingLog[];
  } | null;
  today: string;
};

/**
 * The logging form.
 *
 * Every field is prefilled from what was prescribed, so the common case — the
 * member did what the plan said — is submit-and-done rather than data entry.
 * Deviations are the thing worth typing, and they are the thing that carries
 * information.
 */
export function WorkoutLogForm(props: LogFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(LogWorkoutSession, null);

  // Skipped exercises grey out and stop asking for numbers. Held in React so
  // the visual state matches immediately rather than after a round trip.
  const [skipped, setSkipped] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const ex of props.exercises) {
      const prior = props.existing?.logs.find((l) => l.exerciseId === ex.exercise.id);
      init[ex.id] = prior ? !prior.completed : false;
    }
    return init;
  });

  useEffect(() => {
    if (state?.success) {
      toast.success("Workout logged");
      router.push("/member/workout-plan");
      router.refresh();
    } else if (state && !state.success) {
      toast.error(state.error);
    }
  }, [state, router]);

  const priorFor = (ex: LogExercise) =>
    props.existing?.logs.find((l) => l.exerciseId === ex.exercise.id);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="planDayId" value={props.planDayId} />

      <Card>
        <CardHeader>
          <CardTitle>
            Week {props.weekNumber}, Day {props.dayNumber} — {props.focus}
          </CardTitle>
          <CardDescription>
            {props.existing
              ? `You already logged this on ${props.today}. Saving again updates it.`
              : `Logging for ${props.today}. Values are prefilled from your plan — change whatever you actually did.`}
          </CardDescription>
        </CardHeader>
      </Card>

      {props.exercises.map((ex, i) => {
        const prior = priorFor(ex);
        const isSkipped = skipped[ex.id];

        return (
          <Card key={ex.id} className={isSkipped ? "opacity-60" : undefined}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">
                    {i + 1}. {ex.exercise.name}
                  </CardTitle>
                  <CardDescription>
                    Prescribed: {ex.sets} sets × {ex.reps} reps · {ex.restSeconds}s rest
                  </CardDescription>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {ex.exercise.equipment && (
                      <Badge variant="secondary" className="capitalize">
                        {ex.exercise.equipment}
                      </Badge>
                    )}
                    {ex.exercise.primaryMuscle.map((m) => (
                      <Badge key={m} variant="outline" className="capitalize">
                        {m}
                      </Badge>
                    ))}
                  </div>
                </div>
                <label className="flex shrink-0 items-center gap-2 text-sm">
                  <Checkbox
                    name={`skip_${ex.id}`}
                    checked={isSkipped}
                    onCheckedChange={(v) =>
                      setSkipped((s) => ({ ...s, [ex.id]: v === true }))
                    }
                  />
                  Skipped
                </label>
              </div>
            </CardHeader>

            {!isSkipped && (
              <CardContent className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`sets_${ex.id}`} className="text-xs">
                    Sets done
                  </Label>
                  <Input
                    id={`sets_${ex.id}`}
                    name={`sets_${ex.id}`}
                    type="number"
                    min={0}
                    max={50}
                    inputMode="numeric"
                    defaultValue={prior?.setsCompleted ?? ex.sets}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`reps_${ex.id}`} className="text-xs">
                    Reps
                  </Label>
                  <Input
                    id={`reps_${ex.id}`}
                    name={`reps_${ex.id}`}
                    maxLength={20}
                    defaultValue={prior?.repsCompleted ?? ex.reps}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`weight_${ex.id}`} className="text-xs">
                    Weight (kg)
                  </Label>
                  <Input
                    id={`weight_${ex.id}`}
                    name={`weight_${ex.id}`}
                    type="number"
                    min={0}
                    max={1000}
                    step="0.5"
                    inputMode="decimal"
                    placeholder="—"
                    defaultValue={prior?.weightKg ?? undefined}
                  />
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">How did it go?</CardTitle>
          <CardDescription>Optional, but it is what makes progress readable later.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="durationMinutes" className="text-xs">
                Duration (minutes)
              </Label>
              <Input
                id="durationMinutes"
                name="durationMinutes"
                type="number"
                min={0}
                max={600}
                inputMode="numeric"
                placeholder="—"
                defaultValue={props.existing?.durationMinutes ?? undefined}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="perceivedExertion" className="text-xs">
                Effort (1–10)
              </Label>
              <Input
                id="perceivedExertion"
                name="perceivedExertion"
                type="number"
                min={1}
                max={10}
                inputMode="numeric"
                placeholder="—"
                defaultValue={props.existing?.perceivedExertion ?? undefined}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes" className="text-xs">
              Notes
            </Label>
            <Textarea
              id="notes"
              name="notes"
              maxLength={500}
              rows={3}
              placeholder="Anything worth remembering next time — a niggle, a PB, a machine that was taken."
              defaultValue={props.existing?.notes ?? ""}
            />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" size="lg" disabled={pending}>
        {props.existing ? (
          <IconDeviceFloppy className="mr-2 size-4" />
        ) : (
          <IconCheck className="mr-2 size-4" />
        )}
        {pending ? "Saving…" : props.existing ? "Update this workout" : "Log this workout"}
      </Button>
    </form>
  );
}
