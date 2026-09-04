/**
 * Phase 1 seed + backfill.
 *
 * Run with:  npm run db:seed
 *
 * Two jobs, both idempotent — safe to re-run:
 *   1. Create the first ADMIN account (there is no longer a hardcoded PIN).
 *   2. Backfill a User for every existing Member so nobody is locked out by
 *      the move from Member.password to User.passwordHash.
 *
 * Members are given a temporary password and must change it on first login.
 * The old plaintext passwords are deliberately NOT carried over: they were
 * stored in cleartext, so treating them as compromised is the correct call.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const ROUNDS = 12;

/** Fallback email for legacy members who never had one recorded. */
function placeholderEmail(memberCode: string) {
  return `${memberCode.toLowerCase()}@members.synergyfitness.local`;
}

async function seedAdmin() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "").toLowerCase().trim();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "";

  if (!email || !password) {
    console.log("⚠  SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipping admin.");
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`✓ Admin already exists: ${email}`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, ROUNDS),
      role: "ADMIN",
    },
  });
  console.log(`✓ Created admin: ${email}`);
}

async function backfillMembers() {
  const orphans = await prisma.member.findMany({
    where: { userId: null },
    select: { id: true, name: true, email: true, memberCode: true },
  });

  if (orphans.length === 0) {
    console.log("✓ No members needed backfilling.");
    return;
  }

  const tempPassword = process.env.SEED_MEMBER_TEMP_PASSWORD ?? "Welcome@12345";
  const tempHash = await bcrypt.hash(tempPassword, ROUNDS);

  let created = 0;
  const skipped: string[] = [];

  for (const member of orphans) {
    const email = (member.email?.trim() || placeholderEmail(member.memberCode)).toLowerCase();

    // An email already claimed by another User means we cannot safely link this
    // member — flag it for a human rather than guessing.
    const clash = await prisma.user.findUnique({ where: { email } });
    if (clash) {
      skipped.push(`${member.memberCode} (${member.name}) — email ${email} already in use`);
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, passwordHash: tempHash, role: "MEMBER" },
      });
      await tx.member.update({
        where: { id: member.id },
        data: { userId: user.id },
      });
    });
    created++;
  }

  console.log(`✓ Backfilled ${created} member account(s).`);
  console.log(`  Temporary password for all of them: ${tempPassword}`);
  console.log("  Members without a recorded email sign in with:");
  console.log("    <membercode>@members.synergyfitness.local");

  if (skipped.length) {
    console.log(`\n⚠  ${skipped.length} member(s) skipped — resolve manually:`);
    skipped.forEach((s) => console.log(`   - ${s}`));
  }
}

async function main() {
  await seedAdmin();
  await backfillMembers();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
