"use server";

import { revalidatePath } from "next/cache";
import type { NotifChannel, NotificationType } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireRole, requireUser } from "@/lib/session";
import { notify } from "@/lib/notifications";
import { hasMailKey } from "@/lib/mail";
import { runDailyJob, type DailyRunReport } from "@/notifications/daily";

/**
 * Notifications — the in-app panel, and the two things people trigger by hand
 * (announcements, and "run the daily job now").
 *
 * Every read is scoped to the session user. There is no "get notifications for
 * user X" here: the id comes from the JWT, so a member cannot read another
 * member's renewal warnings or an admin's retention alerts by editing a request.
 */

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  channel: NotifChannel;
  actionUrl: string | null;
  createdAt: string;
  readAt: string | null;
  sentAt: string | null;
};

function toItem(n: {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  channel: NotifChannel;
  actionUrl: string | null;
  createdAt: Date;
  readAt: Date | null;
  sentAt: Date | null;
}): NotificationItem {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    channel: n.channel,
    actionUrl: n.actionUrl,
    createdAt: n.createdAt.toISOString(),
    readAt: n.readAt ? n.readAt.toISOString() : null,
    sentAt: n.sentAt ? n.sentAt.toISOString() : null,
  };
}

/* ─────────────────────────────── reading ─────────────────────────────── */

export async function GetMyNotifications(limit = 50): Promise<NotificationItem[]> {
  const user = await requireUser();
  const rows = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(toItem);
}

export async function GetUnreadCount(): Promise<number> {
  const user = await requireUser();
  return prisma.notification.count({ where: { userId: user.id, readAt: null } });
}

/* ─────────────────────────────── marking ─────────────────────────────── */

/** Which pages show the bell, so a read marks it stale. */
const BELL_PATHS = ["/member", "/member/notifications", "/trainer", "/trainer/notifications", "/notifications"];

function revalidateBells() {
  for (const p of BELL_PATHS) revalidatePath(p);
}

export async function MarkNotificationRead(id: string): Promise<{ success: boolean }> {
  const user = await requireUser();
  // updateMany rather than update so a foreign id is a no-op, not an error
  // that reveals the row exists.
  const r = await prisma.notification.updateMany({
    where: { id, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  if (r.count > 0) revalidateBells();
  return { success: true };
}

export async function MarkAllNotificationsRead(): Promise<{ success: boolean; marked: number }> {
  const user = await requireUser();
  const r = await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  if (r.count > 0) revalidateBells();
  return { success: true, marked: r.count };
}

/* ───────────────────────────── announcements ─────────────────────────── */

export type AnnouncementResult =
  | { success: true; recipients: number; emailed: number }
  | { success: false; error: string };

const announcementSchema = z.object({
  title: z.string().trim().min(3, "Give the announcement a title.").max(120, "Keep the title under 120 characters."),
  body: z.string().trim().min(10, "Say a little more than that.").max(2000, "Keep it under 2000 characters."),
  email: z.boolean(),
});

/**
 * Sends a TRAINER_ANNOUNCEMENT.
 *
 * A trainer reaches only their own clients — members who have booked them or
 * whose plan they own. An admin reaches every member. That scoping is done
 * here from the session, never from a recipient list posted by the browser.
 *
 * Email is opt-in per announcement. The free Brevo tier is 300 messages a day;
 * a gym-wide "the sauna is fixed" should not spend it.
 */
export async function SendAnnouncement(
  _prev: AnnouncementResult | null,
  formData: FormData
): Promise<AnnouncementResult> {
  const user = await requireRole("TRAINER");

  const parsed = announcementSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    email: formData.get("email") === "on",
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const { title, body, email } = parsed.data;

  let memberIds: string[];
  let senderName = "CBG Fitness Center";

  if (user.role === "ADMIN") {
    const members = await prisma.member.findMany({
      where: { userId: { not: null } },
      select: { id: true },
    });
    memberIds = members.map((m) => m.id);
  } else {
    const trainer = await prisma.trainer.findUnique({
      where: { userId: user.id },
      select: { id: true, name: true },
    });
    if (!trainer) return { success: false, error: "No trainer profile is linked to this account." };
    senderName = trainer.name;

    const booked = await prisma.booking.findMany({
      where: { trainerId: trainer.id, status: { not: "CANCELLED" } },
      select: { memberId: true },
      distinct: ["memberId"],
    });
    const planned = await prisma.workoutPlan.findMany({
      where: { trainerId: trainer.id },
      select: { memberId: true },
      distinct: ["memberId"],
    });
    memberIds = [...new Set([...booked, ...planned].map((r) => r.memberId))];
  }

  if (memberIds.length === 0) {
    return { success: false, error: "Nobody to send this to yet — no members are linked to you." };
  }

  const members = await prisma.member.findMany({
    where: { id: { in: memberIds }, userId: { not: null } },
    select: { userId: true },
  });

  let recipients = 0;
  let emailed = 0;
  // Sequential on purpose: connection_limit=1 on the pooler.
  for (const m of members) {
    const r = await notify({
      userId: m.userId!,
      type: "TRAINER_ANNOUNCEMENT",
      title,
      body: `${body}\n\n— ${senderName}`,
      channel: email ? "BOTH" : "IN_APP",
      actionUrl: user.role === "ADMIN" ? "/member" : "/member/trainers",
      metadata: { from: user.id, role: user.role },
    });
    if (r.created) recipients += 1;
    if (r.emailed) emailed += 1;
  }

  revalidateBells();
  return { success: true, recipients, emailed };
}

/* ───────────────────────────── admin overview ────────────────────────── */

export type NotificationOverview = {
  mailConfigured: boolean;
  cronConfigured: boolean;
  /** Most recent retention scoreDate — the cron always recomputes, so this is when it last ran. */
  lastDailyRun: string | null;
  last7Days: Array<{ type: NotificationType; count: number; emailed: number }>;
  recent: Array<NotificationItem & { recipient: string }>;
};

export async function GetNotificationOverview(): Promise<NotificationOverview> {
  await requireRole("ADMIN");

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const latestScore = await prisma.retentionScore.findFirst({
    orderBy: { scoreDate: "desc" },
    select: { scoreDate: true },
  });

  const grouped = await prisma.notification.groupBy({
    by: ["type"],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
  });
  const emailedGrouped = await prisma.notification.groupBy({
    by: ["type"],
    where: { createdAt: { gte: since }, sentAt: { not: null } },
    _count: { _all: true },
  });
  const emailedByType = new Map(emailedGrouped.map((g) => [g.type, g._count._all]));

  const recentRows = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      user: {
        select: {
          email: true,
          role: true,
          member: { select: { name: true } },
          trainer: { select: { name: true } },
        },
      },
    },
  });

  return {
    mailConfigured: hasMailKey(),
    cronConfigured: (process.env.CRON_SECRET?.trim().length ?? 0) >= 16,
    lastDailyRun: latestScore ? latestScore.scoreDate.toISOString() : null,
    last7Days: grouped
      .map((g) => ({ type: g.type, count: g._count._all, emailed: emailedByType.get(g.type) ?? 0 }))
      .sort((a, b) => b.count - a.count),
    recent: recentRows.map((r) => ({
      ...toItem(r),
      recipient:
        r.user.member?.name ??
        r.user.trainer?.name ??
        (r.user.role === "ADMIN" ? `Admin (${r.user.email})` : r.user.email),
    })),
  };
}

export type RunNowResult =
  | { success: true; report: DailyRunReport }
  | { success: false; error: string };

/**
 * The admin's "run now" button. Calls the job directly rather than fetching
 * /api/cron/daily so the secret never has to be in the browser.
 */
export async function RunDailyJobNow(forceWeekly = false): Promise<RunNowResult> {
  await requireRole("ADMIN");
  try {
    const report = await runDailyJob(new Date(), { forceWeekly });
    revalidateBells();
    revalidatePath("/retention");
    return { success: true, report };
  } catch (e) {
    console.error("RunDailyJobNow failed:", e);
    return { success: false, error: e instanceof Error ? e.message : "The daily job failed." };
  }
}
