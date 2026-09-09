/**
 * Demo data for the retention dashboard.
 *
 * Run with:  npm run db:seed:retention
 *
 * Creates five members whose histories land in different risk bands, so the
 * scoring can be demonstrated without waiting months for real churn. Every
 * member here is prefixed RET- and is idempotent on memberCode, so re-running
 * updates rather than duplicating. Never run this against production data.
 */
import { PrismaClient } from "@prisma/client";
import { addDays, format, subDays } from "date-fns";

const prisma = new PrismaClient();
const FMT = "dd-MM-yyyy";
const today = new Date();

/** A check-in this many days ago. */
const daysAgo = (n: number) => format(subDays(today, n), FMT);
const daysAhead = (n: number) => format(addDays(today, n), FMT);

type Profile = {
  code: string;
  name: string;
  gender: "male" | "female" | "other";
  /** dd-MM-yyyy. Everyone used to share 01-01-1995, so every member was 31. */
  dob: string;
  /** 10 digits, no +63 and no leading 0 — the column is a BigInt. */
  phone: string;
  address: string;
  joinedDaysAgo: number;
  /** Days ago on which this member checked in. */
  visits: number[];
  /** Membership end date, relative to today. Negative = already expired. */
  membershipEndsInDays: number | null;
  amount: number;
  paid: number;
  expect: string;
};

/**
 * Each profile is built to exercise a different factor, so the demo shows the
 * model discriminating rather than just producing one high number.
 */
const PROFILES: Profile[] = [
  {
    code: "RET-0001",
    name: "Angelica Reyes",
    gender: "female",
    dob: "14-03-1996",
    phone: "9175534118",
    address: "12 Kalayaan Ave, Brgy. Poblacion, Makati City",
    joinedDaysAgo: 400,
    // Three times a week, unbroken, right up to yesterday.
    visits: Array.from({ length: 26 }, (_, i) => i * 2 + 1),
    membershipEndsInDays: 210,
    amount: 12000,
    paid: 12000,
    expect: "LOW — the control case",
  },
  {
    code: "RET-0002",
    name: "Marco Villanueva",
    gender: "male",
    dob: "22-07-1989",
    phone: "9186642907",
    address: "88 Chino Roces Ave, Brgy. Pio del Pilar, Makati City",
    joinedDaysAgo: 300,
    // Was going 3x/week last month, down to once a fortnight now.
    visits: [6, 20, 33, 36, 39, 42, 45, 48, 51, 54, 57],
    membershipEndsInDays: 120,
    amount: 12000,
    paid: 12000,
    expect: "MEDIUM — frequency trend collapsing",
  },
  {
    code: "RET-0003",
    name: "Ynez Bautista",
    gender: "female",
    dob: "05-11-1998",
    phone: "9209981345",
    address: "5 Jupiter St, Brgy. Bel-Air, Makati City",
    joinedDaysAgo: 240,
    // Stopped six weeks ago and the membership runs out this month.
    visits: [44, 47, 51, 55, 58],
    membershipEndsInDays: 9,
    amount: 12000,
    paid: 9000,
    expect: "HIGH — absent, expiring, owing",
  },
  {
    code: "RET-0004",
    name: "Rafael Dizon",
    gender: "male",
    dob: "30-01-1985",
    phone: "9954471028",
    address: "231 Pasong Tamo Ext, Brgy. Magallanes, Makati City",
    joinedDaysAgo: 500,
    // Nothing in four months and the membership lapsed weeks ago.
    visits: [],
    membershipEndsInDays: -38,
    amount: 12000,
    paid: 6000,
    expect: "CRITICAL — every factor firing",
  },
  {
    code: "RET-0005",
    name: "Nadine Aquino",
    gender: "female",
    dob: "09-09-2002",
    phone: "9776120593",
    address: "17 Kamagong St, Brgy. San Antonio, Makati City",
    joinedDaysAgo: 4,
    // Signed up on Monday and has not been in yet. Should NOT read as at-risk.
    visits: [],
    membershipEndsInDays: 361,
    amount: 12000,
    paid: 12000,
    expect: "LOW — grace period damps a member with no history",
  },
];

async function main() {
  // Sales rows need a service to point at.
  const service =
    (await prisma.services.findFirst({ where: { name: "Annual Membership (demo)" } })) ??
    (await prisma.services.create({
      data: {
        name: "Annual Membership (demo)",
        description: "Seeded for the retention dashboard demo.",
        price: 12000,
        duration: 12,
      },
    }));

  for (const p of PROFILES) {
    const member = await prisma.member.upsert({
      where: { memberCode: p.code },
      update: {
        name: p.name,
        gender: p.gender,
        phone: BigInt(p.phone),
        DOB: p.dob,
        address: p.address,
        DOJ: daysAgo(p.joinedDaysAgo),
      },
      create: {
        memberCode: p.code,
        name: p.name,
        gender: p.gender,
        phone: BigInt(p.phone),
        DOB: p.dob,
        address: p.address,
        DOJ: daysAgo(p.joinedDaysAgo),
      },
    });

    // Rebuild this member's history from scratch so re-running is idempotent.
    await prisma.attendance.deleteMany({ where: { member_id: member.id } });
    await prisma.sales.deleteMany({ where: { member_id: member.id } });

    if (p.visits.length) {
      await prisma.attendance.createMany({
        data: p.visits.map((d) => ({
          member_id: member.id,
          date: daysAgo(d),
          time: "18:30:00",
        })),
      });
    }

    if (p.membershipEndsInDays !== null) {
      await prisma.sales.create({
        data: {
          member_id: member.id,
          service_id: service.id,
          description: "Seeded membership",
          discount: 0,
          amount: p.amount,
          paid: p.paid,
          startDate: daysAgo(p.joinedDaysAgo),
          endDate:
            p.membershipEndsInDays >= 0
              ? daysAhead(p.membershipEndsInDays)
              : daysAgo(Math.abs(p.membershipEndsInDays)),
        },
      });
    }

    console.log(`  ${p.code}  ${p.name.padEnd(18)} ${p.visits.length} visits — expect ${p.expect}`);
  }

  console.log("\nRetention demo data ready. Open /retention and press Recalculate.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
