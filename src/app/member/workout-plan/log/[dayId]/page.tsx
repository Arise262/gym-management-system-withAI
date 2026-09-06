import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkoutLogForm } from "@/components/workout-log-form";
import { GetDayForLogging } from "@/action/workout-session.action";

export default async function LogWorkoutPage({
  params,
}: {
  params: Promise<{ dayId: string }>;
}) {
  const { dayId } = await params;
  const data = await GetDayForLogging(dayId);

  // Null covers both "no such day" and "not this member's day" — the action
  // does not distinguish, so a wrong id cannot be used to probe for real ones.
  if (!data) notFound();

  const { day, session, today } = data;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <Link href="/member/workout-plan">
        <Button variant="ghost" size="sm" className="-ml-2">
          <IconArrowLeft className="mr-1 size-4" />
          Back to plan
        </Button>
      </Link>

      {day.isRestDay ? (
        <Card>
          <CardHeader>
            <CardTitle>Day {day.dayNumber} is a rest day</CardTitle>
            <CardDescription>
              There is nothing to log. Recovery is part of the programme.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/member/workout-plan">
              <Button variant="secondary">Back to plan</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <WorkoutLogForm
          planDayId={day.id}
          focus={day.focus}
          weekNumber={day.weekNumber}
          dayNumber={day.dayNumber}
          exercises={day.exercises}
          existing={
            session
              ? {
                  durationMinutes: session.durationMinutes,
                  perceivedExertion: session.perceivedExertion,
                  notes: session.notes,
                  logs: session.logs.map((l) => ({
                    exerciseId: l.exerciseId,
                    setsCompleted: l.setsCompleted,
                    repsCompleted: l.repsCompleted,
                    weightKg: l.weightKg,
                    completed: l.completed,
                  })),
                }
              : null
          }
          today={today}
        />
      )}
    </div>
  );
}
