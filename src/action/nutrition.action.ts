"use server";

import { z } from "zod";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { requireMemberId } from "@/lib/session";
import { gymToday } from "@/lib/format";
import {
  ageOn,
  dailyTargets,
  eligibility,
  weightAtBmi,
  UNDERWEIGHT_BMI,
  type ActivityLevel,
  type Phase,
  type Sex,
} from "@/lib/nutrition";
import { horizonOutcomes, projectWeight, type ExperienceLevel } from "@/lib/nutrition-projection";
import { explainNutritionPlan } from "@/ai/nutrition-explainer";
import {
  buildNutritionView,
  firstName,
  gymTodayDate,
  toExplainInput,
  type NutritionView,
} from "@/lib/nutrition-view";

/**
 * A member's nutrition phase, daily targets, weigh-ins and progress prediction.
 *
 * Everything is self-service and scoped by requireMemberId(): the member id
 * comes from the signed session, never from the form. The view itself is
 * assembled in src/lib/nutrition-view.ts, which is kept out of this file on
 * purpose — see the note there.
 */

export type ActionResult = { success: true } | { success: false; error: string };

/* ─────────────────────────────── reading ─────────────────────────────── */

export async function GetMyNutrition(): Promise<NutritionView> {
  const memberId = await requireMemberId();
  return buildNutritionView(memberId, prisma);
}

/* ─────────────────────────────── starting ────────────────────────────── */

const weightSchema = z.coerce.number().min(25, "Enter your weight in kilograms.").max(400, "Enter your weight in kilograms.");

const startSchema = z.object({
  phase: z.enum(["CUT", "MAINTAIN", "BULK"], { message: "Choose Cut, Maintain or Bulk." }),
  weightKg: weightSchema,
  heightCm: z.coerce.number().int().min(80, "Enter your height in centimetres.").max(250, "Enter your height in centimetres."),
  activityLevel: z.enum(["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "VERY_ACTIVE"], { message: "Choose your activity level." }),
  targetWeightKg: z.coerce.number().int().min(25, "Enter a target weight in kilograms.").max(400, "Enter a target weight in kilograms.").optional(),
});

export async function StartNutritionPlan(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const memberId = await requireMemberId();

  // A control left blank still arrives as "". Zod's .optional() means absent,
  // not empty — same fix as SaveFitnessProfile.
  const raw = Object.fromEntries(formData);
  for (const key of Object.keys(raw)) if (raw[key] === "") delete raw[key];

  const parsed = startSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const weightKg = Math.round(d.weightKg * 10) / 10;

  // Cut and bulk run toward a goal; without one, a prediction has no end and
  // "when will I get there" has no answer.
  if (d.phase !== "MAINTAIN" && !d.targetWeightKg) {
    return { success: false, error: "Enter your target weight, so we can predict when you'll reach it." };
  }

  const member = await prisma.member.findUniqueOrThrow({
    where: { id: memberId },
    select: { name: true, DOB: true, gender: true, experienceLevel: true },
  });
  const age = ageOn(member.DOB, gymTodayDate());
  const allowed = eligibility({ age, weightKg, heightCm: d.heightCm });
  if (!allowed.ok) return { success: false, error: allowed.reason };
  if (d.phase === "CUT" && allowed.cutBlocked) return { success: false, error: allowed.cutBlocked };

  // The target sets the direction. A bulk toward a lower weight (or a cut
  // toward a higher one) cannot be predicted — the milestones came out as
  // "reach 70 kg: more than a year away, about 85 kg after 12 months".
  if (d.phase === "CUT" && d.targetWeightKg && d.targetWeightKg >= weightKg) {
    return {
      success: false,
      error: `A cut needs a target below your current weight (${weightKg} kg). If you want to gain, choose Bulk.`,
    };
  }
  if (d.phase === "BULK" && d.targetWeightKg && d.targetWeightKg <= weightKg) {
    return {
      success: false,
      error: `A bulk needs a target above your current weight (${weightKg} kg). If you want to lose, choose Cut.`,
    };
  }

  if (d.phase === "CUT" && d.targetWeightKg) {
    const lowest = Math.ceil(weightAtBmi(UNDERWEIGHT_BMI, d.heightCm));
    if (d.targetWeightKg < lowest) {
      return {
        success: false,
        error: `That target is below a healthy BMI of ${UNDERWEIGHT_BMI} for your height. The lowest we can plan a cut toward is ${lowest} kg.`,
      };
    }
  }

  const sex = member.gender as Sex;
  const experienceLevel = (member.experienceLevel ?? "BEGINNER") as ExperienceLevel;
  const targets = dailyTargets(
    { weightKg, heightCm: d.heightCm, age: age!, sex, activityLevel: d.activityLevel, targetWeightKg: d.targetWeightKg, experienceLevel },
    d.phase
  );
  const today = gymToday();

  // One batch, so a failure part-way cannot leave two active plans or a plan
  // with no starting weigh-in.
  const [, , , plan] = await prisma.$transaction([
    prisma.member.update({
      where: { id: memberId },
      data: { heightCm: d.heightCm, activityLevel: d.activityLevel, targetWeightKg: d.targetWeightKg ?? undefined },
    }),
    prisma.fitnessRecord.upsert({
      where: { member_id_date: { member_id: memberId, date: today } },
      update: { weight: weightKg, height: d.heightCm },
      create: { member_id: memberId, date: today, weight: weightKg, height: d.heightCm },
    }),
    prisma.nutritionPlan.updateMany({
      where: { memberId, status: "ACTIVE" },
      data: { status: "ARCHIVED" },
    }),
    prisma.nutritionPlan.create({
      data: {
        memberId,
        phase: d.phase,
        startedOn: today,
        startWeightKg: weightKg,
        heightCm: d.heightCm,
        age: age!,
        sex,
        activityLevel: d.activityLevel,
        targetWeightKg: d.phase === "MAINTAIN" ? null : d.targetWeightKg ?? null,
        calories: targets.calories,
        proteinG: targets.proteinG,
        carbsG: targets.carbsG,
        fatG: targets.fatG,
      },
    }),
  ]);

  // The explanation is a nice-to-have written after the response is sent, so
  // the member is not kept waiting on a model call — and a failed call costs
  // nothing but the fallback text. Same pattern as the welcome email.
  after(async () => {
    const input = {
      phase: d.phase as Phase,
      startWeightKg: weightKg,
      heightCm: d.heightCm,
      age: age!,
      sex,
      activityLevel: d.activityLevel as ActivityLevel,
      calories: targets.calories,
      targetWeightKg: plan.targetWeightKg,
    };
    const projection = projectWeight(input);
    const horizons = horizonOutcomes(input, projection, experienceLevel);
    const explanation = await explainNutritionPlan(
      toExplainInput(firstName(member.name), plan, targets.tdee, projection, horizons)
    );
    if (explanation) {
      await prisma.nutritionPlan.update({
        where: { id: plan.id },
        data: { aiSummary: explanation.text, modelUsed: explanation.modelUsed },
      });
    }
  });

  revalidatePath("/member/nutrition");
  revalidatePath("/member/progress");
  return { success: true };
}

/* ────────────────────────────── weighing in ──────────────────────────── */

export async function LogWeighIn(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const memberId = await requireMemberId();

  const parsed = weightSchema.safeParse(formData.get("weightKg"));
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const weightKg = Math.round(parsed.data * 10) / 10;

  const member = await prisma.member.findUniqueOrThrow({
    where: { id: memberId },
    select: { heightCm: true },
  });
  if (!member.heightCm) {
    return { success: false, error: "Set up your nutrition phase first — we need your height." };
  }

  // A second weigh-in the same day corrects the first rather than adding one.
  const today = gymToday();
  await prisma.fitnessRecord.upsert({
    where: { member_id_date: { member_id: memberId, date: today } },
    update: { weight: weightKg, height: member.heightCm },
    create: { member_id: memberId, date: today, weight: weightKg, height: member.heightCm },
  });

  revalidatePath("/member/progress");
  revalidatePath("/member/nutrition");
  return { success: true };
}
