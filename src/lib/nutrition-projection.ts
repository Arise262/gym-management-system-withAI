/**
 * What a member's nutrition phase is predicted to do over the next year.
 *
 * Weight is predicted from energy balance: eating X kcal a day against a
 * maintenance of Y moves body weight by (X − Y) × 7 ÷ 7,700 kg a week, 7,700
 * kcal being the usual energy content of a kilogram of body tissue.
 *
 * It is simulated WEEK BY WEEK rather than drawn as a straight line. As a
 * member gets lighter their maintenance falls, so a fixed intake produces a
 * smaller deficit each week and the curve flattens — which is what actually
 * happens, and why a straight line would over-promise. Maintenance is
 * recomputed from the simulated weight every week with the same Mifflin–St
 * Jeor formula used for the targets.
 *
 * Everything is shown as a range. Real bodies vary with water, adherence and
 * adaptation, and a single promised number would be dishonest.
 *
 * Pure functions, no database or model call.
 */

import {
  mifflinStJeor,
  tdee,
  weightAtBmi,
  UNDERWEIGHT_BMI,
  type ActivityLevel,
  type Phase,
  type Sex,
} from "@/lib/nutrition";

export const KCAL_PER_KG = 7700;

/** A cut never predicts losing faster than this share of body weight a week. */
const MAX_WEEKLY_LOSS_SHARE = 0.01;

/** Band half-width: a quarter of the predicted change, plus water noise. */
const BAND_SHARE = 0.25;
const BAND_NOISE_KG = 0.5;

/** One year. Past that the model's error outgrows its usefulness. */
export const PROJECTION_WEEKS = 52;

export const HORIZONS = [
  { months: 1, week: 4 },
  { months: 3, week: 13 },
  { months: 6, week: 26 },
  { months: 12, week: 52 },
] as const;

export type ProjectionInput = {
  phase: Phase;
  startWeightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  activityLevel: ActivityLevel;
  calories: number;
  targetWeightKg?: number | null;
};

export type ProjectionPoint = {
  week: number;
  weightKg: number;
  lowKg: number;
  highKg: number;
};

export type Projection = {
  points: ProjectionPoint[];
  /** First week the simulated weight reaches the member's target, if it does. */
  targetWeek: number | null;
  /** First week the change on the scale reaches 2 kg — roughly when clothes fit differently. */
  firstNoticeableWeek: number | null;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function projectWeight(input: ProjectionInput, weeks = PROJECTION_WEEKS): Projection {
  const start = input.startWeightKg;
  const target = input.targetWeightKg ?? null;
  // A cut never predicts going underweight, whatever the target says.
  const lowestSafe = weightAtBmi(UNDERWEIGHT_BMI, input.heightCm);

  const points: ProjectionPoint[] = [{ week: 0, weightKg: start, lowKg: start, highKg: start }];
  let weight = start;
  let targetWeek: number | null = null;
  let firstNoticeableWeek: number | null = null;

  for (let week = 1; week <= weeks; week++) {
    if (input.phase !== "MAINTAIN" && targetWeek === null) {
      const maintenance = tdee(
        mifflinStJeor(weight, input.heightCm, input.age, input.sex),
        input.activityLevel
      );
      let delta = ((input.calories - maintenance) * 7) / KCAL_PER_KG;

      if (input.phase === "CUT") {
        delta = Math.max(delta, -weight * MAX_WEEKLY_LOSS_SHARE);
        const floor = Math.max(lowestSafe, target !== null && target < start ? target : -Infinity);
        if (weight + delta <= floor) {
          weight = floor;
          if (target !== null && floor === target) targetWeek = week;
        } else {
          weight += delta;
        }
      } else {
        // BULK
        if (target !== null && target > start && weight + delta >= target) {
          weight = target;
          targetWeek = week;
        } else {
          weight += delta;
        }
      }
    }
    // MAINTAIN, or target reached: the member switches to eating at
    // maintenance, and weight holds.

    const change = weight - start;
    const spread = Math.abs(change) * BAND_SHARE + BAND_NOISE_KG;
    points.push({
      week,
      weightKg: round1(weight),
      lowKg: round1(weight - spread),
      highKg: round1(weight + spread),
    });

    if (firstNoticeableWeek === null && Math.abs(change) >= 2) firstNoticeableWeek = week;
  }

  return { points, targetWeek, firstNoticeableWeek };
}

/* ------------------------------------------------------------------ */
/* Muscle                                                             */
/* ------------------------------------------------------------------ */

export type ExperienceLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

/**
 * Lean-mass gain per month on a well-run bulk, as a share of body weight.
 *
 * Anchored on Alan Aragon's widely used rate-of-gain guidelines — beginners
 * 1–1.5% of body weight a month, intermediates 0.5–1%, advanced 0.25–0.5% —
 * but those describe TOTAL weight gained on a bulk, part of which is always
 * fat. So the muscle share here is set at roughly half of each band. An 80 kg
 * beginner gets 0.4–0.8 kg of muscle a month: what training CAN produce, not
 * a promise.
 *
 * Beginners do not stay beginners: after six months their rate drops to the
 * intermediate band.
 */
const LEAN_GAIN_SHARE: Record<ExperienceLevel, [number, number]> = {
  BEGINNER: [0.005, 0.01],
  INTERMEDIATE: [0.0025, 0.005],
  ADVANCED: [0.001, 0.0025],
};

/** On a bulk, at least this share of the weight gained is fat, however well it is run. */
const MIN_FAT_SHARE_OF_BULK = 0.3;

/** On a cut or at maintenance, muscle still grows a little in newcomers — "recomposition". */
const RECOMP_SHARE_OF_BULK: Record<Phase, number> = { CUT: 0.25, MAINTAIN: 0.5, BULK: 1 };

const BEGINNER_MONTHS = 6;
const WEEKS_PER_MONTH = 52 / 12;

export type HorizonOutcome = {
  months: number;
  week: number;
  weightKg: number;
  lowKg: number;
  highKg: number;
  changeKg: number;
  /** Lean mass gained, as a [low, high] range. Zero-width means "held". */
  leanKg: [number, number];
  /** Fat change, as a [low, high] range; negative is loss. */
  fatKg: [number, number];
};

function leanGainOver(
  months: number,
  weightKg: number,
  level: ExperienceLevel,
  phase: Phase
): [number, number] {
  // Only newcomers recompose meaningfully; experienced lifters on a cut or at
  // maintenance are doing well to hold what they have.
  if (phase !== "BULK" && level !== "BEGINNER") return [0, 0];

  const scale = RECOMP_SHARE_OF_BULK[phase];
  let low = 0;
  let high = 0;
  // `months` can be fractional (a phase that ends at week 14), so the last
  // month counts only for the part of it that was actually spent in the phase.
  for (let m = 1; m <= Math.ceil(months); m++) {
    const portion = Math.min(1, months - (m - 1));
    const tier: ExperienceLevel =
      level === "BEGINNER" && m > BEGINNER_MONTHS ? "INTERMEDIATE" : level;
    // Recomposition on a cut fades once the easy newcomer gains are used up.
    if (phase !== "BULK" && m > BEGINNER_MONTHS) break;
    const [lo, hi] = LEAN_GAIN_SHARE[tier];
    low += weightKg * lo * scale * portion;
    high += weightKg * hi * scale * portion;
  }
  return [round1(low), round1(high)];
}

export function horizonOutcomes(
  input: ProjectionInput,
  projection: Projection,
  level: ExperienceLevel
): HorizonOutcome[] {
  // Once the target is reached the member switches to maintaining, and the
  // phase's muscle gain stops accruing. Without this, a bulk that ended at
  // week 14 kept crediting muscle for a year while weight sat still — so fat
  // appeared to melt away at maintenance.
  const phaseMonths = projection.targetWeek ? projection.targetWeek / WEEKS_PER_MONTH : Infinity;

  return HORIZONS.map(({ months, week }) => {
    const p = projection.points[Math.min(week, projection.points.length - 1)];
    const changeKg = round1(p.weightKg - input.startWeightKg);
    let lean = leanGainOver(Math.min(months, phaseMonths), input.startWeightKg, level, input.phase);

    // On a bulk, muscle is at most the non-fat share of what the scale gained.
    if (input.phase === "BULK" && changeKg > 0) {
      const ceiling = round1(changeKg * (1 - MIN_FAT_SHARE_OF_BULK));
      lean = [Math.min(lean[0], ceiling), Math.min(lean[1], ceiling)];
    }
    // Weight change = lean change + fat change, so fat is the remainder.
    const fatKg: [number, number] = [round1(changeKg - lean[1]), round1(changeKg - lean[0])];

    return {
      months,
      week,
      weightKg: p.weightKg,
      lowKg: p.lowKg,
      highKg: p.highKg,
      changeKg,
      leanKg: lean,
      fatKg,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Predicted vs actual                                                */
/* ------------------------------------------------------------------ */

export type WeighIn = { day: Date; weightKg: number };

export type TrackStatus =
  | { status: "too-early"; daysLogged: number }
  | {
      status: "on-track" | "slower" | "faster" | "wrong-way";
      actualPerWeek: number;
      predictedPerWeek: number;
    };

/** Daily weight swings 1–2 kg on water alone; two weeks of weigh-ins is the minimum for a trend. */
const MIN_TREND_DAYS = 14;
/** Within ±30% of the predicted rate counts as on track. */
const ON_TRACK_TOLERANCE = 0.3;
/** At maintenance, drifting less than this a week is "holding". */
const MAINTAIN_TOLERANCE_KG = 0.25;

const DAY_MS = 86_400_000;

/**
 * Compares the member's actual weight trend with the prediction.
 *
 * The actual trend is the least-squares slope through every weigh-in since
 * the plan started — not first-vs-last, which a single salty dinner can swing.
 */
export function trackStatus(
  input: ProjectionInput,
  projection: Projection,
  startedOn: Date,
  weighIns: WeighIn[]
): TrackStatus {
  const since = weighIns
    .filter((w) => w.day.getTime() >= startedOn.getTime())
    .sort((a, b) => a.day.getTime() - b.day.getTime());
  if (since.length < 2) return { status: "too-early", daysLogged: 0 };

  const spanDays = (since[since.length - 1].day.getTime() - since[0].day.getTime()) / DAY_MS;
  if (spanDays < MIN_TREND_DAYS) return { status: "too-early", daysLogged: Math.round(spanDays) };

  const xs = since.map((w) => (w.day.getTime() - startedOn.getTime()) / DAY_MS);
  const ys = since.map((w) => w.weightKg);
  const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
  const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const actualPerWeek = round1((den === 0 ? 0 : num / den) * 7);

  // Predicted rate over the same span of weeks.
  const lastWeek = Math.min(Math.round(xs[xs.length - 1] / 7), projection.points.length - 1);
  const firstWeek = Math.min(Math.round(xs[0] / 7), lastWeek);
  const weeksSpan = Math.max(1, lastWeek - firstWeek);
  const predictedPerWeek = round1(
    (projection.points[lastWeek].weightKg - projection.points[firstWeek].weightKg) / weeksSpan
  );

  const base = { actualPerWeek, predictedPerWeek };
  if (input.phase === "MAINTAIN" || Math.abs(predictedPerWeek) < 0.05) {
    return Math.abs(actualPerWeek) <= MAINTAIN_TOLERANCE_KG
      ? { status: "on-track", ...base }
      : { status: actualPerWeek > 0 ? "faster" : "slower", ...base };
  }
  if (Math.sign(actualPerWeek) !== Math.sign(predictedPerWeek) && Math.abs(actualPerWeek) > 0.05) {
    return { status: "wrong-way", ...base };
  }
  const ratio = actualPerWeek / predictedPerWeek;
  if (ratio < 1 - ON_TRACK_TOLERANCE) return { status: "slower", ...base };
  if (ratio > 1 + ON_TRACK_TOLERANCE) return { status: "faster", ...base };
  return { status: "on-track", ...base };
}

/**
 * Targets were calculated for the starting weight. After ~3 kg of change the
 * member's maintenance has moved enough that the targets should be redone.
 */
export const RECALCULATE_AFTER_KG = 3;
