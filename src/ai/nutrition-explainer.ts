import { claude, MODELS, hasClaudeKey } from "@/lib/claude";
import { PHASE_LABEL, type Phase } from "@/lib/nutrition";

/**
 * A plain-language explanation of a member's nutrition targets and prediction.
 *
 * Claude does not calculate anything here. Every number comes from the
 * formulas in src/lib/nutrition*.ts and is handed over as a fact; Claude's only
 * job is to explain those facts in friendly English.
 *
 * Trust nothing, same principle as the workout planner's slug check: any
 * number in the reply that we did not supply means the model made something
 * up, so the reply is thrown away and the formula-written summary is used
 * instead. The AI can word the numbers; it cannot change them.
 */

export type ExplainInput = {
  firstName: string;
  phase: Phase;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  maintenanceKcal: number;
  startWeightKg: number;
  targetWeightKg: number | null;
  /** Predicted weight at 1, 3, 6 and 12 months. */
  horizons: { months: number; weightKg: number }[];
  targetWeek: number | null;
  firstNoticeableWeek: number | null;
};

/** The facts, one per line, exactly as the member will see them on the page. */
function facts(input: ExplainInput): string {
  const lines = [
    `Member's first name: ${input.firstName}`,
    `Phase: ${PHASE_LABEL[input.phase]}`,
    `Daily calories: ${input.calories} kcal`,
    `Maintenance (what they burn): ${input.maintenanceKcal} kcal`,
    `Protein: ${input.proteinG} g, carbs: ${input.carbsG} g, fats: ${input.fatG} g per day`,
    `Starting weight: ${input.startWeightKg} kg`,
  ];
  if (input.targetWeightKg) lines.push(`Target weight: ${input.targetWeightKg} kg`);
  if (input.targetWeek) lines.push(`Predicted to reach the target in about ${input.targetWeek} weeks`);
  if (input.firstNoticeableWeek) {
    lines.push(`A 2 kg change on the scale is predicted by about week ${input.firstNoticeableWeek}`);
  }
  for (const h of input.horizons) {
    lines.push(`Predicted weight after ${h.months} months: about ${h.weightKg} kg`);
  }
  return lines.join("\n");
}

const SYSTEM = `You explain a gym member's nutrition targets to them, in the app of CBG Fitness Center in the Philippines.

Rules:
1. Use ONLY the numbers given in the facts. Do not calculate, estimate or mention any other number — no new totals, percentages, meal counts, ages, or dates.
2. Write 3 to 4 short sentences of plain text. No markdown, no bullet points, no headings, no emoji.
3. Speak to the member directly and warmly, using their first name once.
4. Explain what the phase means for them, what the daily targets are for, and what the prediction shows.
5. Say the prediction assumes they hit their calories and protein most days and keep training, and that weighing in weekly shows whether they are on track.
6. No medical claims, no promises, no diet fads.`;

/** Every number in a piece of text, normalised: "2,190" -> "2190", "72.0" -> "72". */
export function numbersIn(text: string): string[] {
  const found = text.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
  return found.map((n) => {
    const plain = n.replace(/,/g, "");
    return String(Number(plain));
  });
}

/** Numbers in `reply` that do not appear in `supplied`. Empty means the reply is clean. */
export function inventedNumbers(reply: string, supplied: string): string[] {
  const allowed = new Set(numbersIn(supplied));
  return numbersIn(reply).filter((n) => !allowed.has(n));
}

export type Explanation = { text: string; modelUsed: string };

/**
 * One retry: in testing, about one reply in three worked out a number of its
 * own (the daily deficit, say) and was rejected. A second attempt usually
 * comes back clean, and this runs after the response is sent, so the member
 * never waits on it.
 */
const ATTEMPTS = 2;

/**
 * Returns null — never throws — when there is no key, every attempt fails, or
 * every reply invents a number. The caller then shows fallbackSummary().
 */
export async function explainNutritionPlan(input: ExplainInput): Promise<Explanation | null> {
  if (!hasClaudeKey()) return null;
  const supplied = facts(input);
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const result = await attemptExplanation(supplied);
    if (result) return result;
  }
  return null;
}

async function attemptExplanation(supplied: string): Promise<Explanation | null> {
  try {
    const response = await claude.messages.create({
      model: MODELS.nutrition,
      max_tokens: 400,
      system: SYSTEM,
      messages: [{ role: "user", content: `Facts:\n${supplied}\n\nWrite the explanation.` }],
    });
    const text = response.content
      .filter((b): b is typeof b & { type: "text" } => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      // Belt and braces for rule 2: strip any markdown that slips through.
      .replace(/[*_#`]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!text) return null;
    const invented = inventedNumbers(text, supplied);
    if (invented.length > 0) {
      console.warn("[nutrition-explainer] discarded a reply with invented numbers:", invented);
      return null;
    }
    return { text, modelUsed: MODELS.nutrition };
  } catch (err) {
    console.error("[nutrition-explainer] call failed:", err);
    return null;
  }
}

const PHASE_SENTENCE: Record<Phase, string> = {
  CUT: "You're eating a little under what your body burns, so it makes up the difference from stored fat, while the high protein protects your muscle.",
  MAINTAIN: "You're eating about what your body burns, so your weight should hold steady while your training keeps improving how you look and perform.",
  BULK: "You're eating a little over what your body burns, giving your training the extra it needs to build muscle while keeping fat gain small.",
};

/** Formula-written summary, used whenever Claude's explanation is missing. */
export function fallbackSummary(input: ExplainInput): string {
  const parts = [
    `${input.firstName}, your daily target is ${input.calories.toLocaleString()} kcal with ${input.proteinG} g of protein.`,
    PHASE_SENTENCE[input.phase],
  ];
  if (input.targetWeightKg && input.targetWeek) {
    parts.push(
      `If you hit your targets most days and keep training, you're predicted to reach ${input.targetWeightKg} kg in about ${input.targetWeek} weeks.`
    );
  }
  parts.push("Weigh in once a week so we can show you whether you're on track.");
  return parts.join(" ");
}
