"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireMemberId, requireRole, requireUser } from "@/lib/session";
import {
  generateWeeklyTemplate,
  applyProgression,
  PlannerError,
} from "@/ai/workout-planner";

export type PlanActionResult =
  | { success: true; planId: string }
  | { success: false; error: string };

/** Members act on themselves; staff may act on any member. */
async function resolveTargetMember(memberId?: string): Promise<string> {
  const user = await requireUser();
  if (!memberId || memberId === user.memberId) {
    return requireMemberId();
  }
  await requireRole("TRAINER");
  return memberId;
}

/* ─────────────────────────────── profile ─────────────────────────────── */

const profileSchema = z.object({
  fitnessGoal: z.enum(["WEIGHT_LOSS", "MUSCLE_GAIN", "ENDURANCE", "STRENGTH", "GENERAL_FITNESS"]),
  experienceLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  bodyType: z.enum(["ECTOMORPH", "MESOMORPH", "ENDOMORPH"]).optional(),
  activityLevel: z.enum(["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "VERY_ACTIVE"]).optional(),
  workoutDaysPerWeek: z.coerce.number().int().min(1).max(7),
  heightCm: z.coerce.number().int().min(80).max(250).optional(),
  targetWeightKg: z.coerce.number().int().min(25).max(400).optional(),
  availableEquipment: z.array(z.string()).default([]),
  injuries: z.string().max(500).optional(),
  medicalNotes: z.string().max(500).optional(),
});

export async function SaveFitnessProfile(
  _prev: PlanActionResult | null,
  formData: FormData
): Promise<PlanActionResult> {
  const memberId = await requireMemberId();

  const parsed = profileSchema.safeParse({
    ...Object.fromEntries(formData),
    availableEquipment: formData.getAll("availableEquipment").map(String),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const d = parsed.data;
  await prisma.member.update({
    where: { id: memberId },
    data: {
      fitnessGoal: d.fitnessGoal,
      experienceLevel: d.experienceLevel,
      bodyType: d.bodyType ?? null,
      activityLevel: d.activityLevel ?? null,
      workoutDaysPerWeek: d.workoutDaysPerWeek,
      heightCm: d.heightCm ?? null,
      targetWeightKg: d.targetWeightKg ?? null,
      availableEquipment: d.availableEquipment,
      injuries: d.injuries?.trim() || null,
      medicalNotes: d.medicalNotes?.trim() || null,
    },
  });

  revalidatePath("/member/workout-plan");
  return { success: true, planId: "" };
}

/* ────────────────────────────── generation ───────────────────────────── */

const DEFAULT_DURATION_WEEKS = 4;

export async function GenerateWorkoutPlan(
  _prev: PlanActionResult | null,
  formData: FormData
): Promise<PlanActionResult> {
  const memberId = await resolveTargetMember(
    formData.get("memberId") ? String(formData.get("memberId")) : undefined
  );
  const durationWeeks = Number(formData.get("durationWeeks") ?? DEFAULT_DURATION_WEEKS);

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) return { success: false, error: "Member not found." };

  // Most recent recorded weight, if any — informs load and volume choices.
  const latest = await prisma.fitnessRecord.findFirst({
    where: { member_id: memberId },
    orderBy: { createdAt: "desc" },
    select: { weight: true },
  });

  try {
    const { plan, idMap, modelUsed, rejectedIds, usage } = await generateWeeklyTemplate(
      member,
      latest?.weight ?? null
    );

    const days = applyProgression(plan, idMap, durationWeeks);

    const created = await prisma.$transaction(async (tx) => {
      // Only one ACTIVE plan at a time: a member following two plans at once
      // has no meaningful adherence number, which breaks the analytics.
      await tx.workoutPlan.updateMany({
        where: { memberId, status: "ACTIVE" },
        data: { status: "ARCHIVED" },
      });

      return tx.workoutPlan.create({
        data: {
          memberId,
          title: plan.title,
          goal: member.fitnessGoal!,
          durationWeeks,
          daysPerWeek: plan.days.length,
          generatedBy: "AI",
          aiRationale: [plan.rationale, plan.weeklyNotes].filter(Boolean).join("\n\n"),
          modelUsed,
          days: {
            create: days.map((d) => ({
              weekNumber: d.weekNumber,
              dayNumber: d.dayNumber,
              focus: d.focus,
              isRestDay: d.isRestDay,
              exercises: { create: d.exercises },
            })),
          },
        },
      });
    });

    if (rejectedIds.length) {
      console.warn(
        `[planner] dropped ${rejectedIds.length} unrecognised exercise id(s): ${rejectedIds.join(", ")}`
      );
    }
    console.info(
      `[planner] plan ${created.id} for member ${memberId} — ${usage.inputTokens} in / ${usage.outputTokens} out`
    );

    revalidatePath("/member/workout-plan");
    return { success: true, planId: created.id };
  } catch (error) {
    if (error instanceof PlannerError) {
      return { success: false, error: error.message };
    }
    console.error("[planner] generation failed", error);
    return {
      success: false,
      error: "Could not generate a plan right now. Please try again in a moment.",
    };
  }
}

/* ──────────────────────────────── reads ──────────────────────────────── */

export async function GetActivePlan(memberId?: string) {
  const target = await resolveTargetMember(memberId);
  return prisma.workoutPlan.findFirst({
    where: { memberId: target, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    include: {
      days: {
        orderBy: [{ weekNumber: "asc" }, { dayNumber: "asc" }],
        include: {
          exercises: {
            orderBy: { orderIndex: "asc" },
            include: {
              exercise: {
                select: {
                  id: true, name: true, equipment: true,
                  primaryMuscle: true, instructions: true, images: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function GetPlanHistory(memberId?: string) {
  const target = await resolveTargetMember(memberId);
  return prisma.workoutPlan.findMany({
    where: { memberId: target },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, title: true, goal: true, status: true,
      durationWeeks: true, daysPerWeek: true, createdAt: true, modelUsed: true,
    },
  });
}

export async function GetMyFitnessProfile() {
  const memberId = await requireMemberId();
  return prisma.member.findUnique({
    where: { id: memberId },
    select: {
      fitnessGoal: true, experienceLevel: true, bodyType: true,
      activityLevel: true, workoutDaysPerWeek: true, availableEquipment: true,
      injuries: true, medicalNotes: true, heightCm: true, targetWeightKg: true,
    },
  });
}

/** Distinct equipment values in the library, for the profile form's checkboxes. */
export async function GetEquipmentOptions(): Promise<string[]> {
  await requireUser();
  const rows = await prisma.exercise.findMany({
    where: { equipment: { not: null } },
    select: { equipment: true },
    distinct: ["equipment"],
    orderBy: { equipment: "asc" },
  });
  return rows.map((r) => r.equipment!).filter(Boolean);
}
