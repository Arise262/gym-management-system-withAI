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

/**
 * NO length or range limits in these schemas, on purpose.
 *
 * Structured outputs cannot enforce maxLength, minimum/maximum or maxItems —
 * the SDK strips them from the schema it sends and only mentions them in the
 * field description, so the model treats them as hints. But the SDK still
 * re-validates the reply against the full Zod schema, so a single focus label
 * of 41 characters threw away an entire ~45-second, already-paid-for plan with
 * "Could not generate a plan right now". That happened on production.
 *
 * The limits now live in PLAN_LIMITS: stated to the model in the prompt, and
 * applied by normalisePlan() in workout-planner.ts, which clips and clamps an
 * overrun instead of rejecting the plan.
 */
export const PLAN_LIMITS = {
  title: 80,
  rationale: 1500,
  weeklyNotes: 1000,
  focus: 40,
  reps: 20,
  notes: 200,
  sets: { min: 1, max: 10 },
  restSeconds: { min: 0, max: 600 },
  days: 7,
} as const;

export const PlannedExerciseSchema = z.object({
  /**
   * Must be a json_id from the candidate list given in the prompt. Validated
   * against the database after generation — anything unrecognised is dropped
   * rather than trusted, so the plan can only ever contain real exercises.
   */
  exerciseJsonId: z.string(),
  sets: z.number().int().describe("Working sets, 1 to 10."),
  reps: z
    .string()
    .describe('A short prescription like "8-12", "AMRAP" or "30s". At most 20 characters.'),
  restSeconds: z.number().int().describe("Rest between sets in seconds, 0 to 600."),
  notes: z.string().nullable().describe("One short coaching cue, at most 200 characters."),
});

export const PlannedDaySchema = z.object({
  /** 1-based index within the training week, not a calendar weekday. */
  dayNumber: z.number().int().describe("1-based index within the week, 1 to 7."),
  focus: z
    .string()
    .describe('A short label like "Push", "Lower Body" or "Active Recovery". At most 40 characters.'),
  isRestDay: z.boolean(),
  exercises: z.array(PlannedExerciseSchema),
});

export const GeneratedPlanSchema = z.object({
  title: z.string().describe("Plan title, at most 80 characters."),
  /**
   * Why this structure suits this member. Surfaced in the UI and is the
   * evidence that the plan is reasoned rather than arbitrary.
   */
  rationale: z.string().describe("Why this plan suits this member. At most 1500 characters."),
  /** Coaching notes: form cues, warm-up guidance, when to progress. */
  weeklyNotes: z.string().nullable().describe("Coaching notes for the week. At most 1000 characters."),
  days: z.array(PlannedDaySchema).min(1),
});

export type PlannedExercise = z.infer<typeof PlannedExerciseSchema>;
export type PlannedDay = z.infer<typeof PlannedDaySchema>;
export type GeneratedPlan = z.infer<typeof GeneratedPlanSchema>;
