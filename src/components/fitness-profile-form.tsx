"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SaveFitnessProfile } from "@/action/workout-plan.action";

type Profile = {
  fitnessGoal: string | null;
  experienceLevel: string | null;
  bodyType: string | null;
  activityLevel: string | null;
  workoutDaysPerWeek: number | null;
  availableEquipment: string[];
  injuries: string | null;
  medicalNotes: string | null;
  heightCm: number | null;
  targetWeightKg: number | null;
};

const GOALS = [
  ["WEIGHT_LOSS", "Lose weight"],
  ["MUSCLE_GAIN", "Build muscle"],
  ["STRENGTH", "Get stronger"],
  ["ENDURANCE", "Improve endurance"],
  ["GENERAL_FITNESS", "General fitness"],
];
const LEVELS = [
  ["BEGINNER", "Beginner — new to training"],
  ["INTERMEDIATE", "Intermediate — 6+ months"],
  ["ADVANCED", "Advanced — 2+ years"],
];
const BODY_TYPES = [
  ["ECTOMORPH", "Ectomorph — naturally lean"],
  ["MESOMORPH", "Mesomorph — athletic build"],
  ["ENDOMORPH", "Endomorph — gains easily"],
];
const ACTIVITY = [
  ["SEDENTARY", "Sedentary — desk job"],
  ["LIGHT", "Lightly active"],
  ["MODERATE", "Moderately active"],
  ["ACTIVE", "Active"],
  ["VERY_ACTIVE", "Very active — physical job"],
];

export function FitnessProfileForm({
  profile,
  equipmentOptions,
}: {
  profile: Profile | null;
  equipmentOptions: string[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(SaveFitnessProfile, null);

  useEffect(() => {
    if (state?.success) {
      toast.success("Fitness profile saved");
      router.push("/member/workout-plan");
    }
  }, [state, router]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fitness profile</CardTitle>
        <CardDescription>
          These answers are what your workout plan is generated from. The more
          accurate they are, the better the plan fits you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-6">
          <div className="grid gap-3">
            <Label htmlFor="fitnessGoal">
              Primary goal <span className="text-destructive">*</span>
            </Label>
            <Select name="fitnessGoal" defaultValue={profile?.fitnessGoal ?? undefined} required>
              <SelectTrigger id="fitnessGoal"><SelectValue placeholder="Choose a goal" /></SelectTrigger>
              <SelectContent>
                {GOALS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3">
            <Label htmlFor="experienceLevel">
              Experience level <span className="text-destructive">*</span>
            </Label>
            <Select name="experienceLevel" defaultValue={profile?.experienceLevel ?? undefined} required>
              <SelectTrigger id="experienceLevel"><SelectValue placeholder="Choose your level" /></SelectTrigger>
              <SelectContent>
                {LEVELS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3">
            <Label htmlFor="workoutDaysPerWeek">
              Training days per week <span className="text-destructive">*</span>
            </Label>
            <Input
              id="workoutDaysPerWeek" name="workoutDaysPerWeek" type="number"
              min={1} max={7} required
              defaultValue={profile?.workoutDaysPerWeek ?? 3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-3">
              <Label htmlFor="heightCm">Height (cm)</Label>
              <Input id="heightCm" name="heightCm" type="number" min={80} max={250}
                defaultValue={profile?.heightCm ?? ""} placeholder="170" />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="targetWeightKg">Target weight (kg)</Label>
              <Input id="targetWeightKg" name="targetWeightKg" type="number" min={25} max={400}
                defaultValue={profile?.targetWeightKg ?? ""} placeholder="70" />
            </div>
          </div>

          <div className="grid gap-3">
            <Label htmlFor="bodyType">Body type</Label>
            <Select name="bodyType" defaultValue={profile?.bodyType ?? undefined}>
              <SelectTrigger id="bodyType"><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>
                {BODY_TYPES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3">
            <Label htmlFor="activityLevel">Daily activity level</Label>
            <Select name="activityLevel" defaultValue={profile?.activityLevel ?? undefined}>
              <SelectTrigger id="activityLevel"><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>
                {ACTIVITY.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3">
            <Label>Equipment you can use</Label>
            <p className="text-muted-foreground text-sm -mt-1">
              Leave all unchecked if you train at a fully equipped gym.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {equipmentOptions.map((eq) => (
                <label key={eq} className="flex items-center gap-2 text-sm capitalize">
                  <Checkbox
                    name="availableEquipment"
                    value={eq}
                    defaultChecked={profile?.availableEquipment.includes(eq)}
                  />
                  {eq}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            <Label htmlFor="injuries">Injuries or limitations</Label>
            <p className="text-muted-foreground text-sm -mt-1">
              Anything here is excluded from your plan automatically. Be specific
              — e.g. &quot;left knee pain&quot;, &quot;rotator cuff injury&quot;.
            </p>
            <Textarea id="injuries" name="injuries" rows={3} maxLength={500}
              defaultValue={profile?.injuries ?? ""} placeholder="None" />
          </div>

          <div className="grid gap-3">
            <Label htmlFor="medicalNotes">Medical notes</Label>
            <Textarea id="medicalNotes" name="medicalNotes" rows={2} maxLength={500}
              defaultValue={profile?.medicalNotes ?? ""}
              placeholder="Anything your trainer should know" />
          </div>

          {state && !state.success && (
            <p role="alert" className="text-sm font-medium text-destructive">{state.error}</p>
          )}

          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save profile"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
