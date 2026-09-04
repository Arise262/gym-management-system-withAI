import type { Exercise, Member } from "@prisma/client";
import prisma from "@/lib/prisma";

/**
 * Narrows the 873-exercise library to a shortlist for one member.
 *
 * This is plain deterministic filtering, done before the model is involved.
 * Two reasons it is not the model's job:
 *
 *   - Cost and focus. Putting all 873 exercises in the prompt is ~25k tokens
 *     per request and buries the relevant ones in noise.
 *   - Safety. Equipment the gym does not have, and movements that aggravate a
 *     stated injury, are excluded by rule rather than by asking a model to
 *     remember a constraint. A filter cannot forget.
 */

/** Roughly how many candidates to hand the model. Enough for variety, small
 *  enough to stay focused and cheap. */
const TARGET_CANDIDATES = 130;

/** Experience level -> which library levels are appropriate. */
const LEVEL_ALLOWANCE: Record<string, string[]> = {
  BEGINNER: ["beginner"],
  INTERMEDIATE: ["beginner", "intermediate"],
  ADVANCED: ["beginner", "intermediate", "expert"],
};

/** Goal -> exercise categories to prioritise, most relevant first. */
const GOAL_CATEGORIES: Record<string, string[]> = {
  WEIGHT_LOSS: ["cardio", "plyometrics", "strength"],
  MUSCLE_GAIN: ["strength", "powerlifting"],
  STRENGTH: ["powerlifting", "strength", "olympic weightlifting"],
  ENDURANCE: ["cardio", "plyometrics", "strength"],
  GENERAL_FITNESS: ["strength", "cardio", "stretching"],
};

/**
 * Muscle groups a stated injury should rule out.
 * Conservative by design: it is better to drop a usable exercise than to
 * program around an injury the member told us about.
 */
const INJURY_EXCLUSIONS: { match: RegExp; muscles: string[] }[] = [
  { match: /\b(knee|acl|mcl|meniscus)\b/i, muscles: ["quadriceps", "hamstrings", "calves", "glutes"] },
  { match: /\b(shoulder|rotator|labrum)\b/i, muscles: ["shoulders", "chest", "triceps"] },
  { match: /\b(back|spine|lumbar|disc|sciatica)\b/i, muscles: ["lower back", "middle back", "lats", "traps"] },
  { match: /\b(wrist|elbow|tendonitis)\b/i, muscles: ["forearms", "biceps", "triceps"] },
  { match: /\b(ankle|achilles)\b/i, muscles: ["calves"] },
  { match: /\b(hip|groin)\b/i, muscles: ["glutes", "adductors", "abductors", "hamstrings"] },
  { match: /\b(neck|cervical)\b/i, muscles: ["neck", "traps"] },
];

export type CandidateExercise = Pick<
  Exercise,
  "id" | "json_id" | "name" | "level" | "equipment" | "category" | "primaryMuscle" | "mechanic"
>;

type ProfileInput = Pick<
  Member,
  "fitnessGoal" | "experienceLevel" | "availableEquipment" | "injuries"
>;

/** Muscles to avoid given free-text injury notes. */
export function excludedMuscles(injuries: string | null): string[] {
  if (!injuries?.trim()) return [];
  const out = new Set<string>();
  for (const rule of INJURY_EXCLUSIONS) {
    if (rule.match.test(injuries)) rule.muscles.forEach((m) => out.add(m));
  }
  return [...out];
}

export async function selectCandidates(
  profile: ProfileInput
): Promise<{ candidates: CandidateExercise[]; excluded: string[] }> {
  const levels = LEVEL_ALLOWANCE[profile.experienceLevel ?? "BEGINNER"] ?? ["beginner"];
  const categories = GOAL_CATEGORIES[profile.fitnessGoal ?? "GENERAL_FITNESS"] ?? ["strength"];
  const avoid = excludedMuscles(profile.injuries);

  const all = await prisma.exercise.findMany({
    where: {
      level: { in: levels },
      category: { in: categories },
      // Empty availableEquipment means "no restriction recorded" — do not
      // filter it down to nothing.
      ...(profile.availableEquipment.length > 0
        ? { OR: [{ equipment: { in: profile.availableEquipment } }, { equipment: null }] }
        : {}),
    },
    select: {
      id: true, json_id: true, name: true, level: true,
      equipment: true, category: true, primaryMuscle: true, mechanic: true,
    },
  });

  const safe = avoid.length
    ? all.filter((e) => !e.primaryMuscle.some((m) => avoid.includes(m.toLowerCase())))
    : all;

  return { candidates: spreadAcrossMuscles(safe, TARGET_CANDIDATES), excluded: avoid };
}

/**
 * Picks a spread across muscle groups instead of the first N rows.
 *
 * Without this, an alphabetical slice hands the model 130 abdominal exercises
 * and it cannot build a balanced split no matter how good the prompt is.
 * Round-robins across muscle groups, preferring compound movements.
 */
function spreadAcrossMuscles(
  pool: CandidateExercise[],
  limit: number
): CandidateExercise[] {
  if (pool.length <= limit) return pool;

  const byMuscle = new Map<string, CandidateExercise[]>();
  for (const ex of pool) {
    const key = (ex.primaryMuscle[0] ?? "other").toLowerCase();
    if (!byMuscle.has(key)) byMuscle.set(key, []);
    byMuscle.get(key)!.push(ex);
  }

  // Compound lifts first within each group — they carry a program.
  for (const list of byMuscle.values()) {
    list.sort((a, b) => {
      const rank = (e: CandidateExercise) => (e.mechanic === "compound" ? 0 : 1);
      return rank(a) - rank(b) || a.name.localeCompare(b.name);
    });
  }

  const groups = [...byMuscle.keys()].sort();
  const out: CandidateExercise[] = [];
  let round = 0;
  while (out.length < limit) {
    let addedThisRound = false;
    for (const g of groups) {
      const list = byMuscle.get(g)!;
      if (round < list.length) {
        out.push(list[round]);
        addedThisRound = true;
        if (out.length >= limit) break;
      }
    }
    if (!addedThisRound) break; // pool exhausted
    round++;
  }
  return out;
}

/** Compact one-line-per-exercise rendering for the prompt. */
export function renderCandidates(candidates: CandidateExercise[]): string {
  return candidates
    .map(
      (e) =>
        `${e.json_id} | ${e.name} | ${e.level ?? "?"} | ${e.equipment ?? "none"} | ${e.mechanic ?? "?"} | ${e.primaryMuscle.join(",") || "?"}`
    )
    .join("\n");
}
