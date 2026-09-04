import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "@/lib/auth";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  memberId: string | null;
};

/** The signed-in user, or null. Never throws. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? null,
    role: session.user.role,
    memberId: session.user.memberId,
  };
}

/**
 * Guard for pages and server actions.
 *
 * middleware.ts already blocks unauthorised *navigation*, but server actions are
 * POST endpoints that can be invoked directly — they are not covered by the
 * middleware matcher in every case. Every action that touches member data must
 * call this rather than trusting an id passed in from the client.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  // ADMIN is a superset of every other role.
  if (user.role !== "ADMIN" && !roles.includes(user.role)) {
    redirect("/login");
  }
  return user;
}

/** Where each role belongs when it ends up somewhere it has no business being. */
const HOME_BY_ROLE: Record<Role, string> = {
  ADMIN: "/dashboard",
  TRAINER: "/trainer",
  MEMBER: "/member",
};

/**
 * Resolves the Member id for the current session.
 *
 * This is the replacement for `localStorage.getItem('member_id')`. The id comes
 * from the signed JWT, so a member cannot swap it for someone else's.
 *
 * ADMIN and TRAINER accounts have no Member profile, so /member is meaningless
 * for them — they are sent to their own home rather than to /login, which for
 * an already-signed-in user just looks like the app is broken.
 */
export async function requireMemberId(): Promise<string> {
  const user = await requireUser();
  if (!user.memberId) redirect(HOME_BY_ROLE[user.role]);
  return user.memberId;
}
