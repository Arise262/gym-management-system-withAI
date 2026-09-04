"use server";

import prisma from "@/lib/prisma";
import { requireRole, requireUser } from "@/lib/session";

// Type definitions
export interface ExerciseInput {
  json_id: string;
  name: string;
  force?: string;
  level?: string;
  mechanic?: string;
  equipment?: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category?: string;
  images: string[];
}

export interface ExerciseResponse {
  id: string;
  json_id: string;
  name: string;
  force?: string | null;
  level?: string | null;
  mechanic?: string | null;
  equipment?: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category?: string | null;
  images: string[];
  createdAt: Date;
  updatedAt: Date;
}

// 1. AddExercise
export async function AddExercise(
  data: ExerciseInput
): Promise<ExerciseResponse> {
  await requireRole("ADMIN");
  try {
    // Validate inputs
    if (!data.json_id || !data.name) {
      throw new Error("Missing required fields");
    }

    const exercise = await prisma.exercise.create({
      data: {
        json_id: data.json_id,
        name: data.name,
        force: data.force,
        level: data.level,
        mechanic: data.mechanic,
        equipment: data.equipment,
        primaryMuscle: data.primaryMuscles,
        secondaryMuscle: data.secondaryMuscles,
        instructions: data.instructions,
        category: data.category,
        images: data.images || [],
      },
    });

    return {
      ...exercise,
      primaryMuscles: exercise.primaryMuscle,
      secondaryMuscles: exercise.secondaryMuscle,
      force: exercise.force ?? null,
      level: exercise.level ?? null,
      mechanic: exercise.mechanic ?? null,
      equipment: exercise.equipment ?? null,
      category: exercise.category ?? null,
    };
  } catch (error: any) {
    throw new Error(`Failed to add exercise: ${error.message}`);
  }
}

// 2. GetAllExercise
export async function GetAllExercise(): Promise<ExerciseResponse[]> {
  await requireUser();
  try {
    const exercises = await prisma.exercise.findMany({
      orderBy: { name: "asc" },
    });

    return exercises.map((exercise: any) => ({
      ...exercise,
      force: exercise.force ?? undefined,
      level: exercise.level ?? undefined,
      mechanic: exercise.mechanic ?? undefined,
      equipment: exercise.equipment ?? undefined,
      category: exercise.category ?? undefined,
    }));
  } catch (error: any) {
    throw new Error(`Failed to fetch exercises: ${error.message}`);
  }
}

// 3. GetExerciseById
export async function GetExerciseById(
  id: string
): Promise<ExerciseResponse | null> {
  await requireUser();
  try {
    const exercise = await prisma.exercise.findUnique({
      where: { id },
    });

    if (!exercise) {
      return null;
    }

    return {
      ...exercise,
      primaryMuscles: exercise.primaryMuscle,
      secondaryMuscles: exercise.secondaryMuscle,
      force: exercise.force ?? undefined,
      level: exercise.level ?? undefined,
      mechanic: exercise.mechanic ?? undefined,
      equipment: exercise.equipment ?? undefined,
      category: exercise.category ?? undefined,
    };
  } catch (error: any) {
    throw new Error(`Failed to fetch exercise: ${error.message}`);
  }
}
