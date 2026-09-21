/**
 * Clear every person and everything they generated, ready for a real rollout.
 *
 * Run with:  npm run db:reset:people -- --yes
 *
 * Written for the CBG Fitness Center rollout: the members and the one trainer
 * in the database are demo accounts from development, and from launch day
 * members self-register at /register while the admin adds trainers at
 * /trainers/new. Nothing here is reversible, hence the --yes guard.
 *
 * DELETED
 *   Every Member and Trainer, every User whose role is not ADMIN, and all the
 *   rows hanging off them: sales, attendance, weigh-ins, bookings, workout and
 *   nutrition plans, sessions and logs, retention scores, engagement metrics,
 *   conversations and messages, payments, notifications, walk-ins.
 *
 * KEPT
 *   ADMIN users (losing them would lock everyone out), the 890-exercise
 *   library, Services (already the real CBG price list), FoodItems and ToDos.
 *
 * Order matters. Several foreign keys are deliberately NOT onDelete: Cascade —
 * Sales, Attendance and Booking.trainer among them — so children go first and
 * `member.deleteMany` never trips a constraint. A deleteMany({}) is used where
 * every row in the table belongs to a member or trainer anyway, which is
 * cheaper and clearer than filtering by id.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (!process.argv.includes("--yes")) {
    console.error(
      "Refusing to run without --yes. This deletes every member, trainer and\n" +
        "non-admin user, and cannot be undone.\n\n" +
        "  npm run db:reset:people -- --yes\n"
    );
    process.exit(1);
  }

  const before = {
    users: await prisma.user.count(),
    members: await prisma.member.count(),
    trainers: await prisma.trainer.count(),
  };
  console.log(`Before: ${before.users} users, ${before.members} members, ${before.trainers} trainers\n`);

  // Grandchildren first, then children, then the people themselves.
  const steps: Array<[string, () => Promise<{ count: number }>]> = [
    ["payments", () => prisma.payment.deleteMany()],
    ["workout logs", () => prisma.workoutLog.deleteMany()],
    ["workout sessions", () => prisma.workoutSession.deleteMany()],
    ["plan exercises", () => prisma.workoutPlanExercise.deleteMany()],
    ["plan days", () => prisma.workoutPlanDay.deleteMany()],
    ["workout plans", () => prisma.workoutPlan.deleteMany()],
    ["nutrition plans", () => prisma.nutritionPlan.deleteMany()],
    ["bookings", () => prisma.booking.deleteMany()],
    ["trainer availability", () => prisma.trainerAvailability.deleteMany()],
    ["retention scores", () => prisma.retentionScore.deleteMany()],
    ["engagement metrics", () => prisma.engagementMetric.deleteMany()],
    ["attendance", () => prisma.attendance.deleteMany()],
    ["fitness records", () => prisma.fitnessRecord.deleteMany()],
    ["sales", () => prisma.sales.deleteMany()],
    ["messages", () => prisma.message.deleteMany()],
    ["conversation participants", () => prisma.conversationParticipant.deleteMany()],
    ["conversations", () => prisma.conversation.deleteMany()],
    ["notifications", () => prisma.notification.deleteMany()],
    // WalkIn.passId is onDelete: Restrict against itself, so a visit covered by
    // a weekly pass has to go before the purchase row that sold the pass.
    ["walk-in pass visits", () => prisma.walkIn.deleteMany({ where: { passId: { not: null } } })],
    ["walk-ins", () => prisma.walkIn.deleteMany()],
    ["trainers", () => prisma.trainer.deleteMany()],
    ["members", () => prisma.member.deleteMany()],
    ["non-admin users", () => prisma.user.deleteMany({ where: { role: { not: "ADMIN" } } })],
  ];

  for (const [label, run] of steps) {
    const { count } = await run();
    console.log(`  ${String(count).padStart(4)}  ${label}`);
  }

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { email: true },
  });
  console.log(
    `\nKept: ${admins.length} admin (${admins.map((a) => a.email).join(", ")}), ` +
      `${await prisma.exercise.count()} exercises, ${await prisma.services.count()} services.`
  );
  console.log("Members can now register at /register; add trainers at /trainers/new.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
