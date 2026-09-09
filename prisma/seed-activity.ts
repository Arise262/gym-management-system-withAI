/**
 * Demo activity for the member-facing screens.
 *
 * Run with:  npm run db:seed:activity
 *
 * seed-retention.ts gives the ADMIN dashboards something to show. This gives
 * the MEMBER and TRAINER screens the same treatment: without it the demo
 * member has no membership, no check-ins, no logged workouts and no bookings,
 * so /member, /member/progress and the trainer schedule all render as empty
 * states.
 *
 * Idempotent: it clears this member's own history first and rebuilds it, so
 * re-running does not duplicate. Never run this against production data.
 */
import { PrismaClient } from "@prisma/client";
import { addDays, format, subDays } from "date-fns";

const prisma = new PrismaClient();
const FMT = "dd-MM-yyyy";
const today = new Date();
const daysAgo = (n: number) => format(subDays(today, n), FMT);
const daysAhead = (n: number) => format(addDays(today, n), FMT);

/** The member whose screens the demo walks through. */
const MEMBER_NAME = "Miguel Torres";

/** What CBG charges: ₱200 a year to be a member, ₱600 a month on top. */
const ANNUAL_FEE = 200;
const MONTHLY_BILL = 600;
const YEAR_OF_BILLS = MONTHLY_BILL * 12; // ₱7,200

async function main() {
  const member = await prisma.member.findFirst({ where: { name: MEMBER_NAME } });
  if (!member) throw new Error(`${MEMBER_NAME} not found — run db:seed:demo first.`);

  const trainer = await prisma.trainer.findFirst();
  if (!trainer) throw new Error("no trainer found — run db:seed:demo first.");

  const fee =
    (await prisma.services.findFirst({ where: { name: "Membership Fee" } })) ??
    (await prisma.services.create({
      data: {
        name: "Membership Fee",
        description: "Annual membership fee.",
        price: ANNUAL_FEE,
        duration: 12,
      },
    }));

  const monthly =
    (await prisma.services.findFirst({ where: { name: "Monthly Membership" } })) ??
    (await prisma.services.create({
      data: {
        name: "Monthly Membership",
        description: "Monthly membership bill.",
        price: MONTHLY_BILL,
        duration: 1,
      },
    }));

  // --- wipe this member's history so re-running is idempotent -------------
  const oldSessions = await prisma.workoutSession.findMany({
    where: { memberId: member.id },
    select: { id: true },
  });
  await prisma.workoutLog.deleteMany({
    where: { sessionId: { in: oldSessions.map((s) => s.id) } },
  });
  await prisma.workoutSession.deleteMany({ where: { memberId: member.id } });
  await prisma.booking.deleteMany({ where: { memberId: member.id } });
  await prisma.attendance.deleteMany({ where: { member_id: member.id } });
  await prisma.sales.deleteMany({ where: { member_id: member.id } });

  // --- membership, deliberately part-paid --------------------------------
  // The ₱200 joining fee, settled. Nobody is a member without it, so it is
  // never part of the outstanding balance.
  await prisma.sales.create({
    data: {
      member_id: member.id,
      service_id: fee.id,
      description: "Annual membership fee",
      discount: 0,
      amount: ANNUAL_FEE,
      paid: ANNUAL_FEE,
      startDate: daysAgo(60),
      endDate: daysAhead(305),
    },
  });

  // Twelve ₱600 bills = ₱7,200 billed, seven of them collected, so five months
  // (₱3,000) are outstanding. The balance is on purpose: it gives the
  // PayMongo/GCash checkout something real to settle, and it makes this member
  // show up on Pending Payments. It also clears PayMongo's ₱20 minimum.
  await prisma.sales.create({
    data: {
      member_id: member.id,
      service_id: monthly.id,
      description: "Monthly bills — balance payable by GCash",
      discount: 0,
      amount: YEAR_OF_BILLS,
      paid: MONTHLY_BILL * 7,
      startDate: daysAgo(60),
      endDate: daysAhead(305),
    },
  });

  // --- check-ins: roughly 3x a week for the last 6 weeks ------------------
  const visitDays = [2, 4, 6, 9, 11, 13, 16, 18, 21, 23, 25, 28, 30, 32, 35, 37, 39, 42];
  await prisma.attendance.createMany({
    data: visitDays.map((d, i) => ({
      member_id: member.id,
      date: daysAgo(d),
      // Vary the hour so the check-in list does not look machine-made.
      time: i % 3 === 0 ? "07:15:00" : i % 3 === 1 ? "18:30:00" : "19:45:00",
    })),
  });

  // --- logged workouts against the first two weeks of the active plan -----
  const plan = await prisma.workoutPlan.findFirst({
    where: { memberId: member.id, status: "ACTIVE" },
    include: {
      days: {
        where: { weekNumber: { in: [1, 2] }, isRestDay: false },
        include: { exercises: { orderBy: { orderIndex: "asc" } } },
        orderBy: [{ weekNumber: "asc" }, { dayNumber: "asc" }],
      },
    },
  });

  let logged = 0;
  if (plan) {
    // Walk backwards from most recent so week 1 sits furthest in the past.
    const spacing = [3, 5, 8, 10, 12, 15, 17];
    for (const [i, day] of plan.days.entries()) {
      const offset = spacing[plan.days.length - 1 - i] ?? 20 + i;
      const session = await prisma.workoutSession.create({
        data: {
          memberId: member.id,
          planDayId: day.id,
          date: daysAgo(offset),
          durationMinutes: 55 + (i % 3) * 5,
          completed: true,
          perceivedExertion: 6 + (i % 3),
          notes: i === 0 ? "Felt strong, knee held up fine." : null,
        },
      });

      // Progressive overload: week 2 lifts a little heavier than week 1.
      const weekBump = day.weekNumber === 2 ? 2.5 : 0;
      await prisma.workoutLog.createMany({
        data: day.exercises.map((ex, k) => ({
          sessionId: session.id,
          exerciseId: ex.exerciseId,
          setsCompleted: ex.sets,
          repsCompleted: ex.reps,
          weightKg: 20 + k * 5 + weekBump,
          completed: true,
        })),
      });
      logged++;
    }
  }

  // --- bookings with the trainer -----------------------------------------
  // One in the past marked COMPLETED, one upcoming and CONFIRMED, so the
  // trainer's schedule and the member's bookings page both have content.
  await prisma.booking.create({
    data: {
      memberId: member.id,
      trainerId: trainer.id,
      date: daysAgo(9),
      startTime: "18:00",
      endTime: "19:00",
      status: "COMPLETED",
      notes: "Form check on bench press.",
    },
  });
  await prisma.booking.create({
    data: {
      memberId: member.id,
      trainerId: trainer.id,
      date: daysAhead(3),
      startTime: "19:00",
      endTime: "20:00",
      status: "CONFIRMED",
      notes: "Review week 3 progression.",
    },
  });

  console.log(`Activity seeded for ${member.name} (${member.memberCode}):`);
  console.log(
    `  membership   ₱${ANNUAL_FEE} fee paid · ₱${YEAR_OF_BILLS.toLocaleString()} billed · ` +
      `₱${(MONTHLY_BILL * 7).toLocaleString()} paid · ₱${(MONTHLY_BILL * 5).toLocaleString()} outstanding`
  );
  console.log(`  check-ins    ${visitDays.length}`);
  console.log(`  workouts     ${logged} sessions logged against "${plan?.title ?? "no active plan"}"`);
  console.log(`  bookings     2 with ${trainer.name} (1 completed, 1 upcoming)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
