/**
 * Points every Exercise row's `images` at CBG's own photos.
 *
 * Run with:  npm run db:sync:exercise-photos
 *
 * seed-exercises.ts writes the same paths for NEW rows, but it skips rows that
 * already exist, so a library that was seeded before the photos changed needs
 * this. Touches only the `images` column. Grouped by photo set, so it is ~15
 * statements rather than one per exercise. Safe to re-run.
 */
import { PrismaClient } from "@prisma/client";
import raw from "../src/action/exercises.json";
import additions from "../src/action/exercises-2026.json";
import { exercisePhotos, type PhotoSubject } from "../src/lib/exercise-photos";

const prisma = new PrismaClient();

async function main() {
  const exercises = [...raw, ...additions] as PhotoSubject[];

  const bySet = new Map<string, { images: string[]; ids: string[] }>();
  for (const e of exercises) {
    const images = exercisePhotos(e);
    const key = images.join("|");
    const group = bySet.get(key) ?? { images, ids: [] };
    group.ids.push(e.id);
    bySet.set(key, group);
  }

  const updates = await prisma.$transaction(
    [...bySet.values()].map((g) =>
      prisma.exercise.updateMany({ where: { json_id: { in: g.ids } }, data: { images: g.images } })
    )
  );
  const updated = updates.reduce((n, r) => n + r.count, 0);

  // Anything the source files do not know about would keep its old photos.
  const leftover = await prisma.exercise.count({
    where: { NOT: { images: { hasSome: [...bySet.values()].flatMap((g) => g.images) } } },
  });
  const total = await prisma.exercise.count();
  console.log(`Updated ${updated} of ${total} exercises across ${bySet.size} photo sets; ${leftover} without a CBG photo.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
