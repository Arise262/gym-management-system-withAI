/**
 * Daily calorie and macro targets for a member's nutrition phase.
 *
 * Pure functions over plain numbers — no database, no model call — so the same
 * code runs in the admin BMR tool (a client component) and in the member's
 * server-rendered nutrition page, and the two can never disagree.
 *
 * The AI never produces any of these numbers. Claude only writes a
 * plain-language explanation of them afterwards (src/ai/nutrition-explainer.ts).
 */

export type Sex = "male" | "female" | "other";
export type ActivityLevel = "SEDENTARY" | "LIGHT" | "MODERATE" | "ACTIVE" | "VERY_ACTIVE";
export type Phase = "CUT" | "MAINTAIN" | "BULK";

/* ------------------------------------------------------------------ */
/* Energy expenditure                                                 */
/* ------------------------------------------------------------------ */

/**
 * Standard TDEE activity multipliers, keyed by the member profile's
 * ActivityLevel enum. Same five values the admin BMR tool has always shown.
 */
export const ACTIVITY_LEVELS: { level: ActivityLevel; factor: number; label: string }[] = [
  { level: "SEDENTARY", factor: 1.2, label: "Sedentary (office job)" },
  { level: "LIGHT", factor: 1.375, label: "Light exercise (1-2 days/week)" },
  { level: "MODERATE", factor: 1.55, label: "Moderate exercise (3-5 days/week)" },
  { level: "ACTIVE", factor: 1.725, label: "Heavy exercise (6-7 days/week)" },
  { level: "VERY_ACTIVE", factor: 1.9, label: "Athlete (2x per day)" },
];

export const ACTIVITY_FACTORS = Object.fromEntries(
  ACTIVITY_LEVELS.map((a) => [a.level, a.factor])
) as Record<ActivityLevel, number>;

/**
 * Basal metabolic rate, Mifflin–St Jeor. Unrounded.
 *
 * The formula only has male (+5) and female (−161) constants. For "other" we
 * use the midpoint (−78) and say so on the page rather than silently picking one.
 */
export function mifflinStJeor(weightKg: number, heightCm: number, age: number, sex: Sex): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (sex === "male") return base + 5;
  if (sex === "female") return base - 161;
  return base - 78;
}

export function tdee(bmr: number, activity: ActivityLevel): number {
  return bmr * ACTIVITY_FACTORS[activity];
}

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

/** Body weight at a given BMI for this height — used for floors and protein basis. */
export function weightAtBmi(targetBmi: number, heightCm: number): number {
  const m = heightCm / 100;
  return targetBmi * m * m;
}

/**
 * Whole years from a "dd-MM-yyyy" date of birth. Parsed by hand rather than
 * through the analytics helper, which pulls in Prisma and cannot ship to the
 * client bundle.
 */
export function ageOn(dob: string | null | undefined, today: Date = new Date()): number | null {
  const m = dob?.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return null;
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let age = today.getFullYear() - year;
  const beforeBirthday =
    today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day);
  if (beforeBirthday) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

/* ------------------------------------------------------------------ */
/* Targets                                                            */
/* ------------------------------------------------------------------ */

export type NutritionInput = {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  activityLevel: ActivityLevel;
  targetWeightKg?: number | null;
  /** Sets the size of a bulk's surplus. Optional: the admin tool has no such input. */
  experienceLevel?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | null;
};

export type DailyTargets = {
  bmr: number;
  tdee: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** True when the cut was held up by the calorie floor. */
  floorApplied: boolean;
  /** The weight protein was calculated from — differs from body weight at BMI ≥ 30. */
  proteinBasisKg: number;
};

/** A cut takes 20% off maintenance, but never more than this. */
const MAX_DEFICIT_KCAL = 750;
const CUT_FRACTION = 0.2;
/**
 * Lean bulk: a small surplus keeps the fat that comes with it down. Halved for
 * advanced lifters, who can no longer add muscle fast enough to use a bigger
 * one — the projection showed +10% turning mostly into fat for them.
 */
const BULK_FRACTION = 0.1;
const ADVANCED_BULK_FRACTION = 0.05;

/**
 * Lowest daily intake we will ever prescribe, whatever the arithmetic says.
 * Common clinical guidance for unsupervised diets; "other" takes the midpoint,
 * consistent with the BMR constant.
 */
const CALORIE_FLOOR: Record<Sex, number> = { male: 1500, female: 1200, other: 1350 };

/**
 * Protein per kg. Higher in a deficit because that is when muscle is at risk
 * and extra protein is what protects it; 1.8 g/kg covers building and keeping
 * muscle otherwise. Both sit inside the ranges sports-nutrition position
 * stands give for people doing resistance training.
 */
const PROTEIN_PER_KG: Record<Phase, number> = { CUT: 2.2, MAINTAIN: 1.8, BULK: 1.8 };

const FAT_SHARE = 0.25;
const MIN_FAT_PER_KG = 0.6;

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

export function dailyTargets(input: NutritionInput, phase: Phase): DailyTargets {
  const bmr = mifflinStJeor(input.weightKg, input.heightCm, input.age, input.sex);
  const maintenance = tdee(bmr, input.activityLevel);

  let calories = maintenance;
  let floorApplied = false;
  if (phase === "CUT") {
    calories = maintenance - Math.min(maintenance * CUT_FRACTION, MAX_DEFICIT_KCAL);
    const floor = Math.max(bmr, CALORIE_FLOOR[input.sex]);
    if (calories < floor) {
      calories = floor;
      floorApplied = true;
    }
  } else if (phase === "BULK") {
    const surplus = input.experienceLevel === "ADVANCED" ? ADVANCED_BULK_FRACTION : BULK_FRACTION;
    calories = maintenance * (1 + surplus);
  }
  // Nobody needs to aim for 2,187 rather than 2,190.
  calories = roundTo(calories, 10);

  // At BMI 30+, grams per kg of total body weight overshoots badly (a 120 kg
  // member would be told 264 g a day). Use the goal weight, or the weight at
  // BMI 25, instead.
  const obese = bmi(input.weightKg, input.heightCm) >= 30;
  const proteinBasisKg = obese
    ? input.targetWeightKg && input.targetWeightKg < input.weightKg
      ? input.targetWeightKg
      : weightAtBmi(25, input.heightCm)
    : input.weightKg;

  const proteinG = Math.round(proteinBasisKg * PROTEIN_PER_KG[phase]);
  const fatG = Math.round(Math.max((calories * FAT_SHARE) / 9, proteinBasisKg * MIN_FAT_PER_KG));
  const carbsG = Math.max(0, Math.round((calories - proteinG * 4 - fatG * 9) / 4));

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(maintenance),
    calories,
    proteinG,
    carbsG,
    fatG,
    floorApplied,
    proteinBasisKg: Math.round(proteinBasisKg),
  };
}

/* ------------------------------------------------------------------ */
/* Who this is safe to give numbers to                                */
/* ------------------------------------------------------------------ */

export const ADULT_AGE = 18;
export const UNDERWEIGHT_BMI = 18.5;

export type Eligibility =
  | { ok: false; reason: string }
  | {
      ok: true;
      /** Null when a cut is fine; otherwise why it is not offered. */
      cutBlocked: string | null;
    };

/**
 * Whether to calculate targets at all. Deliberately conservative: an adult
 * formula and a calorie deficit are not something to hand a minor, and a cut
 * is not something to hand someone already underweight.
 */
export function eligibility(input: {
  age: number | null;
  weightKg?: number | null;
  heightCm?: number | null;
}): Eligibility {
  if (input.age === null) {
    return {
      ok: false,
      reason:
        "We need a valid date of birth to calculate your targets. Update it on your profile, or ask the front desk.",
    };
  }
  if (input.age < ADULT_AGE) {
    return {
      ok: false,
      reason:
        "Calorie targets here are built on adult formulas, so we don't calculate them for members under 18. A CBG trainer can help you with eating for training instead.",
    };
  }
  const underweight =
    input.weightKg && input.heightCm
      ? bmi(input.weightKg, input.heightCm) < UNDERWEIGHT_BMI
      : false;
  return {
    ok: true,
    cutBlocked: underweight
      ? "Your BMI is already below 18.5, so we don't offer a cut. Maintain or Bulk are the safer choices."
      : null,
  };
}

/**
 * A soft warning when the chosen phase points away from the member's own
 * target weight. Not a block — they may have a reason — just a nudge.
 */
export function phaseWarning(
  phase: Phase,
  weightKg: number,
  targetWeightKg: number | null | undefined
): string | null {
  if (!targetWeightKg) return null;
  const gap = targetWeightKg - weightKg;
  if (phase === "CUT" && gap > 0.5) {
    return `Your target weight (${targetWeightKg} kg) is above your current weight. A bulk fits that goal better than a cut.`;
  }
  if (phase === "BULK" && gap < -0.5) {
    return `Your target weight (${targetWeightKg} kg) is below your current weight. A cut fits that goal better than a bulk.`;
  }
  if (phase === "MAINTAIN" && Math.abs(gap) >= 3) {
    return `Your target weight is ${Math.abs(Math.round(gap))} kg ${gap > 0 ? "above" : "below"} where you are now. Maintaining will hold your weight, not move it toward that target.`;
  }
  return null;
}

export const PHASE_LABEL: Record<Phase, string> = { CUT: "Cut", MAINTAIN: "Maintain", BULK: "Bulk" };

export const PHASE_BLURB: Record<Phase, string> = {
  CUT: "Eat a little under what you burn to lose fat, with high protein to keep your muscle.",
  MAINTAIN: "Eat what you burn. Your weight holds steady while training improves how you look and perform.",
  BULK: "Eat a little over what you burn to build muscle, with a small surplus to keep fat gain down.",
};
