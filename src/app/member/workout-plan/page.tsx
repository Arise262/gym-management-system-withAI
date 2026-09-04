import Link from "next/link";
import { IconArrowLeft, IconSettings } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  WorkoutPlanView,
  GenerateButton,
  type PlanForView,
} from "@/components/workout-plan-view";
import { GetActivePlan, GetMyFitnessProfile } from "@/action/workout-plan.action";

export default async function Page() {
  const [plan, profile] = await Promise.all([GetActivePlan(), GetMyFitnessProfile()]);

  const profileComplete = Boolean(
    profile?.fitnessGoal && profile?.experienceLevel && profile?.workoutDaysPerWeek
  );

  return (
    <div className="p-4 max-w-3xl mx-auto flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link href="/member">
          <Button variant="ghost" size="sm" className="-ml-2">
            <IconArrowLeft className="mr-1 size-4" />
            Back
          </Button>
        </Link>
        <Link href="/member/profile">
          <Button variant="ghost" size="sm">
            <IconSettings className="mr-1 size-4" />
            Fitness profile
          </Button>
        </Link>
      </div>

      {!profileComplete ? (
        <Card>
          <CardHeader>
            <CardTitle>Tell us about your training first</CardTitle>
            <CardDescription>
              Your plan is built from your goal, experience level and available
              equipment. Fill those in and we can generate it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/member/profile">
              <Button>Set up my fitness profile</Button>
            </Link>
          </CardContent>
        </Card>
      ) : !plan ? (
        <Card>
          <CardHeader>
            <CardTitle>No plan yet</CardTitle>
            <CardDescription>
              Generate a personalised {profile!.workoutDaysPerWeek}-day training
              week, built around your goal and the equipment you have.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GenerateButton label="Generate my workout plan" />
          </CardContent>
        </Card>
      ) : (
        <WorkoutPlanView plan={plan as unknown as PlanForView} />
      )}
    </div>
  );
}
