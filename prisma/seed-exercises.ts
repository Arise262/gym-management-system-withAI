/**
 * Loads the bundled exercise library into the Exercise table.
 *
 * Run with:  npm run db:seed:exercises
 *
 * This is a prerequisite for Phase 3: the workout planner picks exercises by
 * FK from this table, which is what prevents the model inventing movements
 * that do not exist. Idempotent via the unique json_id.
 */
import { PrismaClient } from "@prisma/client";
import raw from "../src/action/exercises.json";

const prisma = new PrismaClient();

type RawExercise = {
  id: string;
  name: string;
  force: string | null;
  level: string;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
};

/** "" and null both mean "no equipment recorded" — normalise to null. */
function clean(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

async function main() {
  const exercises = raw as RawExercise[];
  console.log(`Source file: ${exercises.length} exercises`);

  const rows = exercises.map((e) => ({
    json_id: e.id,
    name: e.name,
    force: clean(e.force),
    level: clean(e.level),
    mechanic: clean(e.mechanic),
    equipment: clean(e.equipment),
    primaryMuscle: e.primaryMuscles ?? [],
    secondaryMuscle: e.secondaryMuscles ?? [],
    instructions: e.instructions ?? [],
    category: clean(e.category),
    images: e.images ?? [],
  }));

  // Guard against a duplicate slug in the source file, which would make the
  // whole createMany fail on the unique index.
  const seen = new Set<string>();
  const dupes = rows.filter((r) => (seen.has(r.json_id) ? true : (seen.add(r.json_id), false)));
  if (dupes.length) {
    console.log(`Skipping ${dupes.length} duplicate slug(s) in source`);
  }
  const unique = [...new Map(rows.map((r) => [r.json_id, r])).values()];

  const BATCH = 200;
  let inserted = 0;
  for (let i = 0; i < unique.length; i += BATCH) {
    const res = await prisma.exercise.createMany({
      data: unique.slice(i, i + BATCH),
      skipDuplicates: true,
    });
    inserted += res.count;
    process.stdout.write(`  ${Math.min(i + BATCH, unique.length)}/${unique.length}\r`);
  }

  const total = await prisma.exercise.count();
  console.log(`\nInserted ${inserted} new, ${total} total in Exercise table.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
