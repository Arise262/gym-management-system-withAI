"use server";

import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireMemberId, requireRole, requireUser } from "@/lib/session";

/**
 * Workout logging.
 *
 * A session is one member training on one day. It may hang off a plan day
 * (`planDayId`), which is what makes adherence measurable, or stand alone for
 * a workout done outside the plan.
 *
 * Sessions are keyed by (member, planDay, date) in application code rather
 * than by a database constraint, because the schema deliberately allows a
 * member to train the same plan day more than once in a block — a repeated
 * week is a normal thing to do. Re-logging the same day on the same date
 * updates that day's entry instead of stacking duplicates.
 */

export type SessionActionResult =
  | { success: true; sessionId: string }
  | { success: false; error: string };

/** The date convention every other table in this app uses. */
const DATE_FMT = "dd-MM-yyyy";

/** Members act on themselves; staff may act on any member. */
async function resolveTargetMember(memberId?: string): Promise<string> {
  const user = await requireUser();
  if (!memberId || memberId === user.memberId) {
    return requireMemberId();
  }
  await requireRole("TRAINER");
  return memberId;
}

/* ─────────────────────────────── reading ─────────────────────────────── */

/**
 * A plan day plus whatever has already been logged against it today.
 *
 * Returns null when the day does not belong to the caller — the id comes from
 * a URL, so ownership is checked here rather than assumed.
 */
export async function GetDayForLogging(planDayId: string) {
  const memberId = await requireMemberId();

  const day = await prisma.workoutPlanDay.findFirst({
    where: { id: planDayId, plan: { memberId } },
    include: {
      plan: { select: { id: true, title: true, memberId: true } },
      exercises: {
        orderBy: { orderIndex: "asc" },
        include: {
          exercise: {
            select: { id: true, name: true, equipment: true, primaryMuscle: true },
          },
        },
      },
    },
  });
  if (!day) return null;

  const today = format(new Date(), DATE_FMT);
  const session = await prisma.workoutSession.findFirst({
    where: { memberId, planDayId, date: today },
    include: { logs: true },
  });

  return { day, session, today };
}

/**
 * Plan day ids this member has completed at least once.
 *
 * Returned as a plain array so the plan view can mark days done without
 * fetching a session per day.
 */
export async function GetLoggedPlanDayIds(memberId?: string): Promise<string[]> {
  const target = await resolveTargetMember(memberId);

  const rows = await prisma.workoutSession.findMany({
    where: { memberId: target, completed: true, planDayId: { not: null } },
    select: { planDayId: true },
    distinct: ["planDayId"],
  });

  return rows.map((r) => r.planDayId!).filter(Boolean);
}

/** Recent sessions for the member, newest first. Feeds the history list. */
export async function GetRecentSessions(limit = 20, memberId?: string) {
  const target = await resolveTargetMember(memberId);

  return prisma.workoutSession.findMany({
    where: { memberId: target },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      planDay: { select: { focus: true, weekNumber: true, dayNumber: true } },
      logs: {
        include: { exercise: { select: { name: true } } },
      },
    },
  });
}

/* ─────────────────────────────── writing ─────────────────────────────── */

/**
 * One logged exercise. Everything is optional except the id and the set count,
 * because a half-filled log is still worth more than no log: a member who
 * records that they did the session but not what they lifted has still told us
 * they trained, which is what adherence and retention are measured on.
 */
const loggedExerciseSchema = z.object({
  planExerciseId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  setsCompleted: z.coerce.number().int().min(0).max(50),
  repsCompleted: z.string().trim().max(20).optional(),
  weightKg: z.coerce.number().min(0).max(1000).optional(),
  /** False when the member skipped it — recorded rather than silently dropped. */
  completed: z.boolean(),
});

const sessionSchema = z.object({
  planDayId: z.string().uuid(),
  durationMinutes: z.coerce.number().int().min(0).max(600).optional(),
  perceivedExertion: z.coerce.number().int().min(1).max(10).optional(),
  notes: z.string().trim().max(500).optional(),
});

/**
 * Records a workout.
 *
 * The form posts one group of fields per prescribed exercise, named
 * `<field>_<planExerciseId>`, so the parsing walks the plan day rather than
 * trusting the client to say which exercises exist.
 */
export async function LogWorkoutSession(
  _prev: SessionActionResult | null,
  formData: FormData
): Promise<SessionActionResult> {
  const memberId = await requireMemberId();

  const parsedSession = sessionSchema.safeParse({
    planDayId: formData.get("planDayId"),
    durationMinutes: formData.get("durationMinutes") || undefined,
    perceivedExertion: formData.get("perceivedExertion") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsedSession.success) {
    return { success: false, error: parsedSession.error.issues[0].message };
  }
  const { planDayId, durationMinutes, perceivedExertion, notes } = parsedSession.data;

  // Ownership check: the day id came from a URL and a form field, so it is not
  // trusted. This is the same reason resolveTargetMember exists.
  const day = await prisma.workoutPlanDay.findFirst({
    where: { id: planDayId, plan: { memberId } },
    include: { exercises: { select: { id: true, exerciseId: true } } },
  });
  if (!day) {
    return { success: false, error: "That workout is not part of your plan." };
  }
  if (day.isRestDay) {
    return { success: false, error: "That is a rest day — there is nothing to log." };
  }

  const logs: z.infer<typeof loggedExerciseSchema>[] = [];
  for (const pe of day.exercises) {
    const parsed = loggedExerciseSchema.safeParse({
      planExerciseId: pe.id,
      exerciseId: pe.exerciseId,
      setsCompleted: formData.get(`sets_${pe.id}`) ?? 0,
      repsCompleted: formData.get(`reps_${pe.id}`) || undefined,
      weightKg: formData.get(`weight_${pe.id}`) || undefined,
      completed: formData.get(`skip_${pe.id}`) !== "on",
    });
    if (!parsed.success) {
      return { success: false, error: `${parsed.error.issues[0].message} (exercise ${pe.id})` };
    }
    logs.push(parsed.data);
  }

  if (logs.every((l) => !l.completed)) {
    return { success: false, error: "Every exercise is marked skipped — nothing to record." };
  }

  const today = format(new Date(), DATE_FMT);

  try {
    // One transaction: a session whose logs failed to write would count toward
    // adherence while showing an empty workout, which is worse than no record.
    const sessionId = await prisma.$transaction(async (tx) => {
      const existing = await tx.workoutSession.findFirst({
        where: { memberId, planDayId, date: today },
        select: { id: true },
      });

      const session = existing
        ? await tx.workoutSession.update({
            where: { id: existing.id },
            data: { durationMinutes, perceivedExertion, notes, completed: true },
          })
        : await tx.workoutSession.create({
            data: {
              memberId,
              planDayId,
              date: today,
              durationMinutes,
              perceivedExertion,
              notes,
              completed: true,
            },
          });

      // Replace rather than merge: the form always submits the full day, so
      // stale rows from an earlier save would otherwise survive an edit.
      await tx.workoutLog.deleteMany({ where: { sessionId: session.id } });
      await tx.workoutLog.createMany({
        data: logs.map((l) => ({
          sessionId: session.id,
          exerciseId: l.exerciseId,
          setsCompleted: l.setsCompleted,
          repsCompleted: l.repsCompleted ?? null,
          weightKg: l.weightKg ?? null,
          completed: l.completed,
        })),
      });

      return session.id;
    });

    revalidatePath("/member");
    revalidatePath("/member/workout-plan");
    revalidatePath(`/member/workout-plan/log/${planDayId}`);
    return { success: true, sessionId };
  } catch (e) {
    console.error("LogWorkoutSession failed:", e);
    return { success: false, error: "Could not save your workout. Please try again." };
  }
}

/** Removes a logged session. Cascade takes the logs with it. */
export async function DeleteWorkoutSession(sessionId: string): Promise<SessionActionResult> {
  const memberId = await requireMemberId();

  const session = await prisma.workoutSession.findFirst({
    where: { id: sessionId, memberId },
    select: { id: true, planDayId: true },
  });
  if (!session) {
    return { success: false, error: "That workout is not yours to delete." };
  }

  await prisma.workoutSession.delete({ where: { id: session.id } });

  revalidatePath("/member");
  revalidatePath("/member/workout-plan");
  return { success: true, sessionId: session.id };
}
