import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Member } from "@prisma/client";
import { claude, MODELS, hasClaudeKey } from "@/lib/claude";
import { GeneratedPlanSchema, type GeneratedPlan } from "@/ai/schemas";
import {
  selectCandidates,
  renderCandidates,
  type CandidateExercise,
} from "@/ai/exercise-candidates";

export class PlannerError extends Error {}

const SYSTEM_PROMPT = `You are an experienced strength and conditioning coach building a one-week training template for a gym member.

RULES
1. Only use exercises from the CANDIDATE EXERCISES list. Reference each one by its exact id (the first column). Never invent an exercise or use an id that is not in the list.
2. Produce exactly the number of training days requested. Rest days count toward that number only if you mark isRestDay true, and a rest day must have an empty exercises array.
3. Order exercises within a day from most to least demanding: compound movements before isolation.
4. Match volume and intensity to the member's experience level. A beginner gets fewer sets, simpler movements, and longer rest than an advanced member.
5. Balance the week. Do not train the same muscle group hard on consecutive days.
6. If the member has stated injuries, do not program anything that loads the affected area, and say how you accommodated it in the rationale.
7. The rationale must explain the specific choices for THIS member — their goal, level, and constraints — not generic training advice.

You are writing the template for week 1 only. Later weeks are generated from it by applying progressive overload, so choose exercises that a member can sensibly repeat and add load to for several weeks.`;

type PlannerProfile = Pick<
  Member,
  | "name" | "gender" | "DOB"
  | "fitnessGoal" | "experienceLevel" | "bodyType" | "activityLevel"
  | "workoutDaysPerWeek" | "availableEquipment" | "injuries" | "medicalNotes"
  | "heightCm" | "targetWeightKg"
>;

function describeMember(p: PlannerProfile, latestWeightKg: number | null): string {
  const lines = [
    `Name: ${p.name}`,
    `Gender: ${p.gender}`,
    `Goal: ${p.fitnessGoal}`,
    `Experience: ${p.experienceLevel}`,
    `Training days per week: ${p.workoutDaysPerWeek}`,
  ];
  if (p.bodyType) lines.push(`Body type: ${p.bodyType}`);
  if (p.activityLevel) lines.push(`Daily activity level: ${p.activityLevel}`);
  if (p.heightCm) lines.push(`Height: ${p.heightCm} cm`);
  if (latestWeightKg) lines.push(`Current weight: ${latestWeightKg} kg`);
  if (p.targetWeightKg) lines.push(`Target weight: ${p.targetWeightKg} kg`);
  lines.push(
    p.availableEquipment.length
      ? `Available equipment: ${p.availableEquipment.join(", ")}`
      : `Available equipment: not specified (assume a standard commercial gym)`
  );
  if (p.injuries?.trim()) lines.push(`Injuries / limitations: ${p.injuries.trim()}`);
  if (p.medicalNotes?.trim()) lines.push(`Medical notes: ${p.medicalNotes.trim()}`);
  return lines.join("\n");
}

export type GenerationResult = {
  plan: GeneratedPlan;
  /** json_id -> Exercise.id, for the rows the plan actually references. */
  idMap: Map<string, string>;
  modelUsed: string;
  /** Ids the model returned that were not in the candidate list. */
  rejectedIds: string[];
  usage: { inputTokens: number; outputTokens: number };
};

export async function generateWeeklyTemplate(
  profile: PlannerProfile,
  latestWeightKg: number | null
): Promise<GenerationResult> {
  if (!hasClaudeKey()) {
    throw new PlannerError(
      "ANTHROPIC_API_KEY is not set. Add it to .env to generate workout plans."
    );
  }
  if (!profile.fitnessGoal || !profile.experienceLevel || !profile.workoutDaysPerWeek) {
    throw new PlannerError(
      "This member's fitness profile is incomplete. Set a goal, experience level and training days per week first."
    );
  }

  const { candidates, excluded } = await selectCandidates(profile);
  if (candidates.length < 10) {
    throw new PlannerError(
      "Not enough suitable exercises matched this member's equipment and experience level. Widen the available equipment and try again."
    );
  }

  const userPrompt = [
    "MEMBER PROFILE",
    describeMember(profile, latestWeightKg),
    "",
    excluded.length
      ? `Muscle groups already excluded from the candidate list because of stated injuries: ${excluded.join(", ")}.`
      : "",
    "",
    `CANDIDATE EXERCISES (id | name | level | equipment | mechanic | primary muscles)`,
    renderCandidates(candidates),
    "",
    `Build a ${profile.workoutDaysPerWeek}-day training week for this member.`,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await claude.messages.parse({
    model: MODELS.planner,
    max_tokens: 8000,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        // Stable across every request, so it is worth caching. The member
        // profile and candidate list come after this and vary per call.
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
    output_config: { format: zodOutputFormat(GeneratedPlanSchema) },
  });

  const plan = response.parsed_output;
  if (!plan) {
    throw new PlannerError(
      "The model did not return a usable plan. Please try generating again."
    );
  }

  // Trust nothing: keep only exercises that exist in the candidate list. The
  // schema guarantees the SHAPE of exerciseJsonId, not that it is a real row.
  const byJsonId = new Map(candidates.map((c: CandidateExercise) => [c.json_id, c.id]));
  const rejectedIds: string[] = [];

  const cleanedDays = plan.days.map((day) => {
    const kept = day.exercises.filter((ex) => {
      const known = byJsonId.has(ex.exerciseJsonId);
      if (!known) rejectedIds.push(ex.exerciseJsonId);
      return known;
    });
    return { ...day, exercises: kept };
  });

  const usable = cleanedDays.filter((d) => d.isRestDay || d.exercises.length > 0);
  if (usable.length === 0) {
    throw new PlannerError(
      "The generated plan contained no recognisable exercises. Please try again."
    );
  }

  return {
    plan: { ...plan, days: usable },
    idMap: byJsonId,
    modelUsed: MODELS.planner,
    rejectedIds,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}

/* ────────────────────────── progressive overload ────────────────────────── */

/**
 * Weekly progression multipliers applied to the week-1 template.
 *
 * A standard 4-week block: three weeks of accumulating volume followed by a
 * deload. This is a documented training principle applied as a formula, not a
 * model guess — which is why it is computed here and can be shown as a table.
 *
 *   week 1 : baseline
 *   week 2 : +1 rep at the top of the range
 *   week 3 : +1 set on compound work, +2 reps
 *   week 4 : deload — volume cut, intensity maintained
 */
const PROGRESSION: Record<number, { setDelta: number; repDelta: number; label: string }> = {
  1: { setDelta: 0, repDelta: 0, label: "Baseline — establish form and working loads" },
  2: { setDelta: 0, repDelta: 1, label: "Volume up — add a rep to each set" },
  3: { setDelta: 1, repDelta: 2, label: "Peak volume — add a set and two reps" },
  4: { setDelta: -1, repDelta: 0, label: "Deload — reduce volume, keep the loads" },
};

/** Shifts a rep prescription like "8-12" by n. Leaves "AMRAP"/"30s" alone. */
export function shiftReps(reps: string, delta: number): string {
  if (delta === 0) return reps;
  const range = reps.match(/^(\d+)\s*-\s*(\d+)$/);
  if (range) {
    const lo = Math.max(1, parseInt(range[1], 10) + delta);
    const hi = Math.max(lo, parseInt(range[2], 10) + delta);
    return `${lo}-${hi}`;
  }
  const single = reps.match(/^(\d+)$/);
  if (single) return String(Math.max(1, parseInt(single[1], 10) + delta));
  return reps; // AMRAP, timed holds, etc.
}

export type ExpandedDay = {
  weekNumber: number;
  dayNumber: number;
  focus: string;
  isRestDay: boolean;
  exercises: {
    exerciseId: string;
    orderIndex: number;
    sets: number;
    reps: string;
    restSeconds: number;
    notes: string | null;
  }[];
};

/** Expands the one-week template across the full plan duration. */
export function applyProgression(
  template: GeneratedPlan,
  idMap: Map<string, string>,
  durationWeeks: number
): ExpandedDay[] {
  const out: ExpandedDay[] = [];

  for (let week = 1; week <= durationWeeks; week++) {
    // Blocks repeat every 4 weeks: week 5 behaves like week 1.
    const step = PROGRESSION[((week - 1) % 4) + 1];

    for (const day of template.days) {
      out.push({
        weekNumber: week,
        dayNumber: day.dayNumber,
        focus: day.isRestDay ? day.focus : `${day.focus} — ${step.label}`,
        isRestDay: day.isRestDay,
        exercises: day.exercises.map((ex, i) => ({
          exerciseId: idMap.get(ex.exerciseJsonId)!,
          orderIndex: i,
          sets: Math.max(1, ex.sets + step.setDelta),
          reps: shiftReps(ex.reps, step.repDelta),
          restSeconds: ex.restSeconds,
          notes: ex.notes,
        })),
      });
    }
  }

  return out;
}
