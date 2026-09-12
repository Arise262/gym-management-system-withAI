"use server";

import { addDays, format, parse } from "date-fns";
import type { Prisma, WalkInRate } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { formatAppDate, gymTime, gymToday, toAppDate } from "@/lib/format";
import { coverageEnd } from "@/lib/duration";
import { WALK_IN_RATES, WEEKLY_PASS_DAYS, isWalkInRate, normaliseName } from "@/lib/walk-in";

/**
 * Walk-ins: non-members who pay per session at the front desk, or buy a
 * 7-day pass.
 *
 * A pass is the visit it was bought on (rate WEEKLY, amount ₱280, validUntil
 * set). Every later visit that week is its own WalkIn row pointing back at the
 * purchase through passId, with amount 0 — "covered", so nothing is charged
 * twice and revenue still sums correctly.
 *
 * Same access as member check-in (the desk), except deleting a record, which
 * is ADMIN-only like DeleteAttendanceById — a desk that can delete paid
 * walk-ins can make cash disappear.
 *
 * Amounts are always looked up from the rate here, never taken from the
 * browser, so the price charged cannot be edited in a request.
 */

const DATE_FMT = "dd-MM-yyyy";

export type WalkInRow = {
  id: string;
  name: string;
  rate: WalkInRate;
  amount: number;
  paidAt: Date | null;
  date: string;
  time: string;
  /** Pass purchases only: last day covered. */
  validUntil: string | null;
  /** Covered visits only: the pass this visit used. */
  pass: { id: string; paid: boolean; validUntil: string | null } | null;
};

export type ActivePass = {
  id: string;
  name: string;
  boughtOn: string;
  validUntil: string;
  paid: boolean;
  checkedInToday: boolean;
};

export type WalkInResult =
  | { success: true; walkIn: WalkInRow; message: string }
  | { success: false; error: string };

const SELECT = {
  id: true,
  name: true,
  rate: true,
  amount: true,
  paidAt: true,
  date: true,
  time: true,
  validUntil: true,
  pass: { select: { id: true, paidAt: true, validUntil: true } },
} satisfies Prisma.WalkInSelect;

type Selected = Prisma.WalkInGetPayload<{ select: typeof SELECT }>;

function toRow(w: Selected): WalkInRow {
  const { pass, ...rest } = w;
  return { ...rest, pass: pass ? { id: pass.id, paid: pass.paidAt !== null, validUntil: pass.validUntil } : null };
}

const NAME_MAX = 80;

/** The last WEEKLY_PASS_DAYS gym days, today included — every day a pass still valid today could have been bought on. */
function passWindow(today: string): string[] {
  const t = parse(today, DATE_FMT, new Date());
  return Array.from({ length: WEEKLY_PASS_DAYS }, (_, i) => format(addDays(t, -i), DATE_FMT));
}

/** Passes still valid today, optionally only those in one name. */
async function findActivePasses(today: string, name?: string) {
  const passes = await prisma.walkIn.findMany({
    where: {
      rate: "WEEKLY",
      passId: null,
      date: { in: passWindow(today) },
      ...(name ? { name: { equals: name, mode: "insensitive" as const } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      date: true,
      validUntil: true,
      paidAt: true,
      passVisits: { where: { date: today }, select: { id: true }, take: 1 },
    },
  });
  // validUntil is a dd-MM-yyyy string, so the "still valid" check is in TS.
  const t = parse(today, DATE_FMT, new Date()).getTime();
  return passes.filter((p) => p.validUntil && parse(p.validUntil, DATE_FMT, new Date()).getTime() >= t);
}

/**
 * Records a visit on a pass. One per pass per day: checking the same person in
 * twice returns the visit already on file, like member check-in does.
 */
async function visitOnPass(passId: string, today: string): Promise<WalkInResult> {
  const pass = await prisma.walkIn.findUnique({
    where: { id: passId },
    select: { id: true, name: true, rate: true, passId: true, date: true, validUntil: true },
  });
  if (!pass || pass.rate !== "WEEKLY" || pass.passId !== null || !pass.validUntil) {
    return { success: false, error: "That weekly pass could not be found." };
  }
  const t = parse(today, DATE_FMT, new Date()).getTime();
  if (parse(pass.validUntil, DATE_FMT, new Date()).getTime() < t) {
    return { success: false, error: `${pass.name}'s weekly pass ended on ${formatAppDate(pass.validUntil)}.` };
  }

  const until = formatAppDate(pass.validUntil);
  if (pass.date === today) {
    const bought = await prisma.walkIn.findUniqueOrThrow({ where: { id: pass.id }, select: SELECT });
    return { success: true, walkIn: toRow(bought), message: `${pass.name} bought the pass today — already checked in.` };
  }
  const existing = await prisma.walkIn.findFirst({ where: { passId: pass.id, date: today }, select: SELECT });
  if (existing) {
    return { success: true, walkIn: toRow(existing), message: `${pass.name} is already checked in today.` };
  }

  const visit = await prisma.walkIn.create({
    data: { name: pass.name, rate: "WEEKLY", amount: 0, date: today, time: gymTime(), passId: pass.id },
    select: SELECT,
  });
  return { success: true, walkIn: toRow(visit), message: `${pass.name} checked in on their weekly pass (until ${until}).` };
}

export async function AddWalkIn(input: { name: string; rate: string; paid: boolean }): Promise<WalkInResult> {
  await requireRole("TRAINER");

  const name = normaliseName(input.name);
  if (!name) return { success: false, error: "Enter the walk-in's name." };
  if (name.length > NAME_MAX) return { success: false, error: `Keep the name under ${NAME_MAX} characters.` };
  if (!isWalkInRate(input.rate)) return { success: false, error: "Choose a rate." };

  const today = gymToday();

  // Someone with a pass that is still running is covered, whatever rate the
  // desk had selected — this is what stops a pass holder paying again.
  const [active] = await findActivePasses(today, name);
  if (active) {
    if (input.rate === "WEEKLY") {
      return { success: false, error: `${active.name} already has a weekly pass until ${formatAppDate(active.validUntil)}.` };
    }
    return visitOnPass(active.id, today);
  }

  const weekly = input.rate === "WEEKLY";
  const validUntil = weekly
    ? format(coverageEnd(parse(today, DATE_FMT, new Date()), WEEKLY_PASS_DAYS, "DAY"), DATE_FMT)
    : null;

  const walkIn = await prisma.walkIn.create({
    data: {
      name,
      rate: input.rate,
      amount: WALK_IN_RATES[input.rate].price,
      paidAt: input.paid ? new Date() : null,
      date: today,
      time: gymTime(),
      validUntil,
    },
    select: SELECT,
  });
  const price = `₱${walkIn.amount}`;
  return {
    success: true,
    walkIn: toRow(walkIn),
    message: weekly
      ? `${name} bought a weekly pass (${price}, until ${formatAppDate(validUntil)}) · ${input.paid ? "paid" : "unpaid"}`
      : `${name} checked in · ${price} ${input.paid ? "paid" : "unpaid"}`,
  };
}

/** One-tap check-in for someone already holding a pass. */
export async function CheckInWithPass(passId: string): Promise<WalkInResult> {
  await requireRole("TRAINER");
  return visitOnPass(passId, gymToday());
}

export async function GetActiveWalkInPasses(): Promise<ActivePass[]> {
  await requireRole("TRAINER");
  const today = gymToday();
  const passes = await findActivePasses(today);
  return passes.map((p) => ({
    id: p.id,
    name: p.name,
    boughtOn: p.date,
    validUntil: p.validUntil!,
    paid: p.paidAt !== null,
    checkedInToday: p.date === today || p.passVisits.length > 0,
  }));
}

/** Marks a walk-in paid (cash taken now) or back to unpaid (a mis-tap). */
export async function SetWalkInPaid(id: string, paid: boolean): Promise<WalkInResult> {
  await requireRole("TRAINER");
  const row = await prisma.walkIn.findUnique({ where: { id }, select: { passId: true } });
  if (!row) return { success: false, error: "That walk-in no longer exists." };
  if (row.passId) return { success: false, error: "This visit is covered by a weekly pass — mark the pass itself paid." };

  const walkIn = await prisma.walkIn.update({
    where: { id },
    data: { paidAt: paid ? new Date() : null },
    select: SELECT,
  });
  return {
    success: true,
    walkIn: toRow(walkIn),
    message: paid ? `${walkIn.name} marked paid · ₱${walkIn.amount}` : `${walkIn.name} marked unpaid`,
  };
}

export async function GetWalkInsByDate(date: string): Promise<WalkInRow[]> {
  await requireRole("TRAINER");
  const day = toAppDate(date);
  if (!day) throw new Error("Invalid date format. Use dd-MM-yyyy");
  const rows = await prisma.walkIn.findMany({ where: { date: day }, orderBy: { createdAt: "desc" }, select: SELECT });
  return rows.map(toRow);
}

export async function DeleteWalkIn(id: string): Promise<{ success: true } | { success: false; error: string }> {
  await requireRole("ADMIN");
  // A pass with visits on it cannot go first: those visits would be left
  // claiming a pass that no longer exists (the foreign key refuses it anyway).
  const visits = await prisma.walkIn.count({ where: { passId: id } });
  if (visits > 0) {
    return {
      success: false,
      error: `This weekly pass has ${visits} later ${visits === 1 ? "visit" : "visits"} on it — remove ${visits === 1 ? "that" : "those"} first.`,
    };
  }
  try {
    await prisma.walkIn.delete({ where: { id } });
    return { success: true };
  } catch {
    return { success: false, error: "That walk-in no longer exists." };
  }
}
