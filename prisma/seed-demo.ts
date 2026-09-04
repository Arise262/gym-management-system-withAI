/**
 * Demo accounts for local testing and the defense walkthrough.
 *
 * Run with:  npm run db:seed:demo
 *
 * Creates one TRAINER and one MEMBER with known passwords so every role can be
 * demonstrated. Idempotent — re-running updates the password rather than
 * failing on the unique email. Never run this against anything but a demo DB.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { format } from "date-fns";

const prisma = new PrismaClient();
const ROUNDS = 12;

const DEMO_PASSWORD = "Demo@12345";

async function upsertTrainer(email: string, name: string) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, ROUNDS);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "TRAINER", isActive: true },
    create: { email, passwordHash, role: "TRAINER" },
  });

  // A TRAINER user without a Trainer profile has no bookable identity — they
  // cannot be browsed or booked, so the role is useless on its own.
  const trainer = await prisma.trainer.upsert({
    where: { userId: user.id },
    update: { name },
    create: {
      userId: user.id,
      name,
      bio: "Demo trainer account for testing and walkthroughs.",
      specializations: ["strength", "weight loss"],
      certifications: ["NASM-CPT"],
      hourlyRate: 500,
    },
  });

  // Reconciled separately rather than as a nested create on the upsert: a
  // nested create only runs on INSERT, so re-seeding an existing trainer would
  // silently leave whatever availability happened to be there.
  for (const dayOfWeek of [1, 2, 3, 4, 5]) {
    await prisma.trainerAvailability.upsert({
      where: {
        trainerId_dayOfWeek_startTime: {
          trainerId: trainer.id,
          dayOfWeek,
          startTime: "09:00",
        },
      },
      update: { endTime: "17:00" },
      create: { trainerId: trainer.id, dayOfWeek, startTime: "09:00", endTime: "17:00" },
    });
  }

  return user;
}

async function upsertMember(email: string, name: string) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, ROUNDS);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "MEMBER", isActive: true },
    create: { email, passwordHash, role: "MEMBER" },
  });

  const existing = await prisma.member.findUnique({ where: { userId: user.id } });
  if (existing) return user;

  // Reuse the same code generator shape as member.action.ts.
  let memberCode = "";
  for (let i = 0; i < 10; i++) {
    const candidate = `MEM${(Math.floor(Math.random() * 999999) + 1)
      .toString()
      .padStart(7, "0")}`;
    if (!(await prisma.member.findUnique({ where: { memberCode: candidate } }))) {
      memberCode = candidate;
      break;
    }
  }
  if (!memberCode) throw new Error("could not generate a unique member code");

  await prisma.member.create({
    data: {
      userId: user.id,
      name,
      email,
      memberCode,
      phone: BigInt("9171234567"),
      gender: "male",
      DOB: "01-01-2000",
      DOJ: format(new Date(), "dd-MM-yyyy"),
    },
  });

  return user;
}

async function main() {
  await upsertTrainer("trainer@synergyfitness.local", "Demo Trainer");
  await upsertMember("member@synergyfitness.local", "Demo Member");

  console.log("Demo accounts ready (password for both: " + DEMO_PASSWORD + ")");
  console.log("  TRAINER  trainer@synergyfitness.local");
  console.log("  MEMBER   member@synergyfitness.local");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
