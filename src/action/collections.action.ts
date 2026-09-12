"use server";

import type { WalkInRate } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { gymDayBounds, gymTime, toAppDate } from "@/lib/format";
import { centavosToPesos } from "@/lib/paymongo";

/**
 * One gym day's takings — what the desk counts at closing.
 *
 * Two sources, both in WHOLE PESOS here:
 *  - walk-ins recorded that day (paid or not — unpaid ones are listed so the
 *    desk can chase them before the guest leaves), and
 *  - Payment rows settled that day, cash from the desk and online from
 *    PayMongo, kept apart because only the cash is in the drawer.
 *
 * Membership money paid before this page existed has no Payment row (the desk
 * only moved Sales.paid), so earlier days show walk-ins and online only.
 */

export type DailyCollections = {
  date: string;
  walkIns: Array<{
    id: string;
    name: string;
    rate: WalkInRate;
    amount: number;
    paid: boolean;
    time: string;
    /** A visit covered by a weekly pass bought on an earlier day — nothing to collect. */
    covered: boolean;
    /** Pass purchases only. */
    validUntil: string | null;
  }>;
  payments: Array<{ id: string; member: string; memberCode: string; service: string | null; amount: number; method: string; cash: boolean; time: string }>;
  totals: {
    walkInCash: number;
    walkInsPaid: number;
    walkInsUnpaid: number;
    walkInsCovered: number;
    passesSold: number;
    unpaidAmount: number;
    membershipCash: number;
    online: number;
    /** Everything in the drawer: walk-in cash + membership cash. */
    cashInDrawer: number;
    /** Cash plus online. */
    collected: number;
  };
};

export async function GetDailyCollections(date: string): Promise<DailyCollections> {
  await requireRole("ADMIN");
  const day = toAppDate(date);
  const bounds = day ? gymDayBounds(day) : undefined;
  if (!day || !bounds) throw new Error("Invalid date format. Use dd-MM-yyyy");

  const walkIns = await prisma.walkIn.findMany({
    where: { date: day },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, rate: true, amount: true, paidAt: true, time: true, passId: true, validUntil: true },
  });
  const payments = await prisma.payment.findMany({
    where: { status: "PAID", paidAt: { gte: bounds.start, lt: bounds.end } },
    orderBy: { paidAt: "asc" },
    select: {
      id: true,
      amount: true,
      provider: true,
      method: true,
      paidAt: true,
      member: { select: { name: true, memberCode: true } },
      sale: { select: { service: { select: { name: true } } } },
    },
  });

  const walkInRows = walkIns.map((w) => ({
    id: w.id,
    name: w.name,
    rate: w.rate,
    amount: w.amount,
    paid: w.paidAt !== null,
    time: w.time,
    covered: w.passId !== null,
    validUntil: w.validUntil,
  }));
  const charged = walkInRows.filter((w) => !w.covered);
  const paymentRows = payments.map((p) => ({
    id: p.id,
    member: p.member.name,
    memberCode: p.member.memberCode,
    service: p.sale?.service.name ?? null,
    amount: Math.round(centavosToPesos(p.amount)),
    method: p.method ?? p.provider,
    cash: p.provider === "cash",
    time: p.paidAt ? gymTime(p.paidAt) : "",
  }));

  const paidWalkIns = charged.filter((w) => w.paid);
  const walkInCash = paidWalkIns.reduce((s, w) => s + w.amount, 0);
  const unpaidAmount = charged.filter((w) => !w.paid).reduce((s, w) => s + w.amount, 0);
  const membershipCash = paymentRows.filter((p) => p.cash).reduce((s, p) => s + p.amount, 0);
  const online = paymentRows.filter((p) => !p.cash).reduce((s, p) => s + p.amount, 0);

  return {
    date: day,
    walkIns: walkInRows,
    payments: paymentRows,
    totals: {
      walkInCash,
      walkInsPaid: paidWalkIns.length,
      walkInsUnpaid: charged.length - paidWalkIns.length,
      walkInsCovered: walkInRows.length - charged.length,
      passesSold: charged.filter((w) => w.rate === "WEEKLY").length,
      unpaidAmount,
      membershipCash,
      online,
      cashInDrawer: walkInCash + membershipCash,
      collected: walkInCash + membershipCash + online,
    },
  };
}
