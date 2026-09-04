// zod/v4, not "zod". The SDK's zodOutputFormat helper requires v4 types, and
// zod 3.25 ships v4 under this subpath. The rest of the app keeps importing
// "zod" (v3) — these schemas are the only place v4 is used.
import { z } from "zod/v4";

/**
 * What the model is asked to return.
 *
 * Deliberately ONE week, not the whole plan. Weeks 2..N are expanded in
 * TypeScript by applying progressive overload (see applyProgression in
 * workout-planner.ts). Three reasons:
 *
 *   1. Cost — a 4-week plan is ~4x the output tokens for no extra insight,
 *      since weeks mostly repeat with small load increases.
 *   2. Reliability — long structured outputs are where models drift, repeat
 *      themselves, or truncate. One week is comfortably inside a safe size.
 *   3. Defensibility — progressive overload is a documented training
 *      principle, so computing it is more rigorous than having a model
 *      re-guess it four times. The formula can go on a slide; a guess cannot.
 */

export const PlannedExerciseSchema = z.object({
  /**
   * Must be a json_id from the candidate list given in the prompt. Validated
   * against the database after generation — anything unrecognised is dropped
   * rather than trusted, so the plan can only ever contain real exercises.
   */
  exerciseJsonId: z.string(),
  sets: z.number().int().min(1).max(10),
  /** A range like "8-12", or "AMRAP" / "30s" for timed work. */
  reps: z.string().min(1).max(20),
  restSeconds: z.number().int().min(0).max(600),
  notes: z.string().max(200).nullable(),
});

export const PlannedDaySchema = z.object({
  /** 1-based index within the training week, not a calendar weekday. */
  dayNumber: z.number().int().min(1).max(7),
  /** Short label: "Push", "Lower Body", "Active Recovery". */
  focus: z.string().min(1).max(40),
  isRestDay: z.boolean(),
  exercises: z.array(PlannedExerciseSchema),
});

export const GeneratedPlanSchema = z.object({
  title: z.string().min(1).max(80),
  /**
   * Why this structure suits this member. Surfaced in the UI and is the
   * evidence that the plan is reasoned rather than arbitrary.
   */
  rationale: z.string().min(1).max(1500),
  /** Coaching notes: form cues, warm-up guidance, when to progress. */
  weeklyNotes: z.string().max(1000).nullable(),
  days: z.array(PlannedDaySchema).min(1).max(7),
});

export type PlannedExercise = z.infer<typeof PlannedExerciseSchema>;
export type PlannedDay = z.infer<typeof PlannedDaySchema>;
export type GeneratedPlan = z.infer<typeof GeneratedPlanSchema>;
