import type { PrismaClient } from "@prisma/client";
import { format } from "date-fns";
import { gymToday } from "@/lib/format";
import { parseGymDate } from "@/analytics/signals";
import {
  ageOn,
  dailyTargets,
  eligibility,
  phaseWarning,
  type ActivityLevel,
  type DailyTargets,
  type Eligibility,
  type Phase,
  type Sex,
} from "@/lib/nutrition";
import {
  horizonOutcomes,
  projectWeight,
  trackStatus,
  RECALCULATE_AFTER_KG,
  type ExperienceLevel,
  type HorizonOutcome,
  type Projection,
  type TrackStatus,
} from "@/lib/nutrition-projection";
import { fallbackSummary, type ExplainInput } from "@/ai/nutrition-explainer";

/**
 * Assembles everything the Nutrition and Progress pages show for one member.
 *
 * Deliberately NOT in a "use server" file. Every export of such a file is an
 * endpoint the browser can call with arguments of its choosing, and this one
 * takes a member id — exported from there, it would hand any member's data to
 * anyone who asked. The server action in nutrition.action.ts resolves the id
 * from the session and calls this.
 *
 * Takes the database client as a parameter so a test can pass a transaction
 * and roll it back.
 */

type Db = Pick<PrismaClient, "member" | "fitnessRecord" | "nutritionPlan">;

/** Today at the gym as a Date, for ages. The server clock is UTC; Manila is not. */
export function gymTodayDate(): Date {
  return parseGymDate(gymToday()) ?? new Date();
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "there";
}

export type WeighInRow = { date: string; label: string; weightKg: number };

export type NutritionView = {
  firstName: string;
  sex: Sex;
  age: number | null;
  heightCm: number | null;
  activityLevel: ActivityLevel | null;
  targetWeightKg: number | null;
  experienceLevel: ExperienceLevel;
  hasMedicalNotes: boolean;
  latestWeightKg: number | null;
  eligibility: Eligibility;
  weighIns: WeighInRow[];
  loggedToday: boolean;
  plan: null | {
    phase: Phase;
    startedOn: string;
    startWeightKg: number;
    targetWeightKg: number | null;
    targets: DailyTargets;
    summary: string;
    summaryByAI: boolean;
    projection: Projection;
    horizons: HorizonOutcome[];
    track: TrackStatus;
    warning: string | null;
    /** Weight has moved far enough that the targets should be recalculated. */
    recalculate: boolean;
  };
};

export async function buildNutritionView(memberId: string, db: Db): Promise<NutritionView> {
  const member = await db.member.findUniqueOrThrow({
    where: { id: memberId },
    select: {
      name: true,
      DOB: true,
      gender: true,
      heightCm: true,
      activityLevel: true,
      targetWeightKg: true,
      experienceLevel: true,
      medicalNotes: true,
    },
  });
  const records = await db.fitnessRecord.findMany({
    where: { member_id: memberId },
    select: { date: true, weight: true },
  });
  const plan = await db.nutritionPlan.findFirst({
    where: { memberId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });

  const weighIns = records
    .map((r) => ({ day: parseGymDate(r.date), date: r.date, weightKg: r.weight }))
    .filter((r): r is { day: Date; date: string; weightKg: number } => Boolean(r.day) && r.weightKg > 0)
    .sort((a, b) => a.day.getTime() - b.day.getTime());

  const latestWeightKg = weighIns.length ? weighIns[weighIns.length - 1].weightKg : null;
  const age = ageOn(member.DOB, gymTodayDate());
  const experienceLevel = (member.experienceLevel ?? "BEGINNER") as ExperienceLevel;

  const view: NutritionView = {
    firstName: firstName(member.name),
    sex: member.gender as Sex,
    age,
    heightCm: member.heightCm,
    activityLevel: member.activityLevel as ActivityLevel | null,
    targetWeightKg: member.targetWeightKg,
    experienceLevel,
    hasMedicalNotes: Boolean(member.medicalNotes?.trim()),
    latestWeightKg,
    eligibility: eligibility({ age, weightKg: latestWeightKg, heightCm: member.heightCm }),
    weighIns: weighIns.map((w) => ({ date: w.date, label: format(w.day, "d MMM"), weightKg: w.weightKg })),
    loggedToday: weighIns.some((w) => w.date === gymToday()),
    plan: null,
  };

  if (!plan) return view;

  // Everything below is computed from the SNAPSHOT the plan started with, so
  // the prediction stays anchored and can be compared against real weigh-ins.
  const input = {
    phase: plan.phase as Phase,
    startWeightKg: plan.startWeightKg,
    heightCm: plan.heightCm,
    age: plan.age,
    sex: plan.sex as Sex,
    activityLevel: plan.activityLevel as ActivityLevel,
    calories: plan.calories,
    targetWeightKg: plan.targetWeightKg,
  };
  const targets = dailyTargets(
    {
      weightKg: plan.startWeightKg,
      heightCm: plan.heightCm,
      age: plan.age,
      sex: input.sex,
      activityLevel: input.activityLevel,
      targetWeightKg: plan.targetWeightKg,
      experienceLevel,
    },
    input.phase
  );
  const projection = projectWeight(input);
  const horizons = horizonOutcomes(input, projection, experienceLevel);
  const startedOn = parseGymDate(plan.startedOn) ?? plan.createdAt;

  view.plan = {
    phase: input.phase,
    startedOn: plan.startedOn,
    startWeightKg: plan.startWeightKg,
    targetWeightKg: plan.targetWeightKg,
    // The stored numbers are what the member was given; show exactly those.
    targets: { ...targets, calories: plan.calories, proteinG: plan.proteinG, carbsG: plan.carbsG, fatG: plan.fatG },
    summary:
      plan.aiSummary ?? fallbackSummary(toExplainInput(view.firstName, plan, targets.tdee, projection, horizons)),
    summaryByAI: Boolean(plan.aiSummary),
    projection,
    horizons,
    track: trackStatus(input, projection, startedOn, weighIns),
    warning: phaseWarning(input.phase, plan.startWeightKg, plan.targetWeightKg),
    recalculate:
      latestWeightKg !== null && Math.abs(latestWeightKg - plan.startWeightKg) >= RECALCULATE_AFTER_KG,
  };
  return view;
}

export function toExplainInput(
  name: string,
  plan: {
    phase: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    startWeightKg: number;
    targetWeightKg: number | null;
  },
  maintenanceKcal: number,
  projection: Projection,
  horizons: HorizonOutcome[]
): ExplainInput {
  return {
    firstName: name,
    phase: plan.phase as Phase,
    calories: plan.calories,
    proteinG: plan.proteinG,
    carbsG: plan.carbsG,
    fatG: plan.fatG,
    maintenanceKcal,
    startWeightKg: plan.startWeightKg,
    targetWeightKg: plan.targetWeightKg,
    horizons: horizons.map((h) => ({ months: h.months, weightKg: h.weightKg })),
    targetWeek: projection.targetWeek,
    firstNoticeableWeek: projection.firstNoticeableWeek,
  };
}
