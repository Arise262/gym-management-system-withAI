"use server";
import prisma from "@/lib/prisma";
import { isWithinInterval, parse } from "date-fns";
import { requireMemberId, requireRole } from "@/lib/session";

/**
 * Full profile for a member.
 *
 * `member_id` is optional and only honoured for ADMIN/TRAINER callers. A member
 * always reads their own record, resolved from the session — passing someone
 * else's id does nothing. Previously this took the id straight from the client,
 * so any member could read any other member's data by changing one string.
 */
export async function getAllDetailsOfMember(member_id?: string) {
  let targetId: string;

  if (member_id) {
    // Only staff may look up an arbitrary member.
    await requireRole("TRAINER");
    targetId = member_id;
  } else {
    targetId = await requireMemberId();
  }

  const today = new Date();
  const user = await prisma.member.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      name: true,
      email: true,
      memberCode: true,
      phone: true,
      address: true,
      DOB: true,
      gender: true,
      DOJ: true,
    },
  });

  const allSalesOfMember = await prisma.sales.findMany({
    where: { member_id: targetId },
    include: { service: true },
  });

  const activeSales = allSalesOfMember.filter((sale) => {
    const startDate = parse(sale.startDate, "dd-MM-yyyy", new Date());
    const endDate = parse(sale.endDate, "dd-MM-yyyy", new Date());
    return isWithinInterval(today, { start: startDate, end: endDate });
  });
  const inActiveSales = allSalesOfMember.filter((sale) => {
    const startDate = parse(sale.startDate, "dd-MM-yyyy", new Date());
    const endDate = parse(sale.endDate, "dd-MM-yyyy", new Date());
    return !isWithinInterval(today, { start: startDate, end: endDate });
  });

  const allAttendanceOfMember = await prisma.attendance.findMany({
    where: { member_id: targetId },
  });

  return { user, activeSales, inActiveSales, allAttendanceOfMember };
}
