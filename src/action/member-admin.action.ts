"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { hashPassword } from "@/lib/accounts";
import { deliverLogin, tempPassword, type LoginDelivery } from "@/lib/login-delivery";

/**
 * The login side of a member, for the admin back office: resetting a
 * forgotten password and deleting the member outright.
 *
 * Members change their own password from /member/change-password. This is for
 * the member who cannot sign in at all — the front desk issues a temporary
 * password the same way it does for trainers (see lib/login-delivery.ts).
 */

export type MemberAccount = {
  email: string | null;
  lastLoginAt: Date | null;
  /** What a delete would take with it — shown in the confirmation. */
  payments: number;
  totalPaid: number;
  visits: number;
};

export async function GetMemberAccount(memberId: string): Promise<MemberAccount | null> {
  await requireRole("ADMIN");
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      user: { select: { email: true, lastLoginAt: true } },
      _count: { select: { sales: true, attendance: true } },
    },
  });
  if (!member) return null;
  const paid = await prisma.sales.aggregate({ where: { member_id: memberId }, _sum: { paid: true } });
  return {
    email: member.user?.email ?? null,
    lastLoginAt: member.user?.lastLoginAt ?? null,
    payments: member._count.sales,
    totalPaid: paid._sum.paid ?? 0,
    visits: member._count.attendance,
  };
}

/** Issues a new temporary password — for a member who forgot theirs. */
export async function ResetMemberPassword(memberId: string): Promise<{ success: true; login: LoginDelivery } | { success: false; error: string }> {
  await requireRole("ADMIN");
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { name: true, user: { select: { id: true, email: true, isActive: true } } },
  });
  if (!member) return { success: false, error: "That member no longer exists." };
  if (!member.user) return { success: false, error: "This member has no login account." };
  if (!member.user.isActive) return { success: false, error: "This member's account is disabled." };

  const password = tempPassword();
  await prisma.user.update({ where: { id: member.user.id }, data: { passwordHash: await hashPassword(password) } });
  return { success: true, login: await deliverLogin(member.user.email, member.name, password, { isNew: false, audience: "member" }) };
}

/**
 * Deletes a member, their login, and everything recorded about them.
 *
 * Sales and Attendance point at Member without onDelete: Cascade, so they
 * must go first or the member delete is refused. Everything else hanging off
 * Member (payments, bookings, plans, sessions, scores) and off User
 * (notifications, chat participation) cascades. Conversations the member was
 * in are removed too — without them the other side would be left talking to
 * no one. This cannot be undone, and it takes the member's payments out of
 * the revenue reports; the confirmation dialog says so.
 */
export async function DeleteMember(memberId: string): Promise<{ success: true; message: string } | { success: false; error: string }> {
  await requireRole("ADMIN");
  const member = await prisma.member.findUnique({ where: { id: memberId }, select: { name: true, userId: true } });
  if (!member) return { success: false, error: "That member no longer exists." };

  await prisma.$transaction(async (tx) => {
    await tx.attendance.deleteMany({ where: { member_id: memberId } });
    await tx.sales.deleteMany({ where: { member_id: memberId } });
    if (member.userId) {
      await tx.conversation.deleteMany({ where: { participants: { some: { userId: member.userId } } } });
    }
    await tx.member.delete({ where: { id: memberId } });
    if (member.userId) await tx.user.delete({ where: { id: member.userId } });
  });

  revalidatePath("/members");
  return { success: true, message: `${member.name} has been deleted.` };
}
