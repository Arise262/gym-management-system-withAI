import type { NotifChannel, NotificationType, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { isDeliverable, renderEmail, sendMail } from "@/lib/mail";

/**
 * Notification core.
 *
 * Every notification is a `Notification` row first and an email second. The
 * row is the source of truth: the in-app panel reads it, `readAt` records when
 * it was seen, and `sentAt` records whether the email actually left. If Brevo
 * is down or unconfigured the row still exists and the cron retries the send,
 * so a member never silently misses a renewal warning because mail hiccuped.
 *
 * `dedupeKey` is how the daily job stays idempotent. cron-job.org retries on
 * timeouts, the admin can press "run now", and a member can hit the same
 * reminder threshold on two consecutive days — none of those should produce a
 * second copy. The key lives in `metadata` (JSON) so no migration was needed.
 */

export type NotifyInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  channel?: NotifChannel;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
  /** Stable id for this exact notification. If one exists already, nothing is created. */
  dedupeKey?: string;
};

export type NotifyResult = {
  created: boolean;
  id: string | null;
  emailed: boolean;
};

/** The public URL used in email buttons. Falls back to localhost for dev. */
export function appOrigin(): string {
  const explicit = process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

async function alreadySent(dedupeKey: string): Promise<boolean> {
  const hit = await prisma.notification.findFirst({
    where: { metadata: { path: ["dedupeKey"], equals: dedupeKey } },
    select: { id: true },
  });
  return Boolean(hit);
}

/**
 * Creates one notification and, if it carries an email channel, tries to send
 * it right away. Never throws: notifications are a side effect of something
 * more important (a payment, a booking) and must not be able to fail it.
 */
export async function notify(input: NotifyInput): Promise<NotifyResult> {
  try {
    if (input.dedupeKey && (await alreadySent(input.dedupeKey))) {
      return { created: false, id: null, emailed: false };
    }

    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        email: true,
        isActive: true,
        member: { select: { name: true } },
        trainer: { select: { name: true } },
      },
    });
    if (!user || !user.isActive) return { created: false, id: null, emailed: false };

    // Downgrade to IN_APP when the address can never receive mail, so the row
    // is not left looking like a failed send the cron should keep retrying.
    const wantsEmail = input.channel === "EMAIL" || input.channel === "BOTH";
    const channel: NotifChannel =
      wantsEmail && isDeliverable(user.email) ? (input.channel as NotifChannel) : "IN_APP";

    const metadata: Record<string, unknown> = { ...(input.metadata ?? {}) };
    if (input.dedupeKey) metadata.dedupeKey = input.dedupeKey;

    const row = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        channel,
        actionUrl: input.actionUrl ?? null,
        metadata: metadata as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    let emailed = false;
    if (channel !== "IN_APP") {
      emailed = await deliverEmail(row.id, {
        to: user.email,
        toName: user.member?.name ?? user.trainer?.name ?? null,
        title: input.title,
        body: input.body,
        actionUrl: input.actionUrl ?? null,
      });
    }

    return { created: true, id: row.id, emailed };
  } catch (e) {
    console.error("[notify] failed:", e);
    return { created: false, id: null, emailed: false };
  }
}

/** Convenience: address a member by Member.id rather than User.id. */
export async function notifyMember(
  memberId: string,
  input: Omit<NotifyInput, "userId">
): Promise<NotifyResult> {
  const member = await prisma.member.findUnique({ where: { id: memberId }, select: { userId: true } });
  if (!member?.userId) return { created: false, id: null, emailed: false };
  return notify({ ...input, userId: member.userId });
}

/** Convenience: address a trainer by Trainer.id. */
export async function notifyTrainer(
  trainerId: string,
  input: Omit<NotifyInput, "userId">
): Promise<NotifyResult> {
  const trainer = await prisma.trainer.findUnique({ where: { id: trainerId }, select: { userId: true } });
  if (!trainer) return { created: false, id: null, emailed: false };
  return notify({ ...input, userId: trainer.userId });
}

/** Sends the same notification to every active ADMIN. Sequential — see connection_limit=1. */
export async function notifyAdmins(input: Omit<NotifyInput, "userId">): Promise<number> {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { id: true },
  });
  let n = 0;
  for (const a of admins) {
    const r = await notify({
      ...input,
      userId: a.id,
      dedupeKey: input.dedupeKey ? `${input.dedupeKey}:${a.id}` : undefined,
    });
    if (r.created) n += 1;
  }
  return n;
}

type EmailJob = {
  to: string;
  toName: string | null;
  title: string;
  body: string;
  actionUrl: string | null;
};

/** Sends one notification's email and stamps `sentAt` on success. */
async function deliverEmail(notificationId: string, job: EmailJob): Promise<boolean> {
  const link = job.actionUrl ? `${appOrigin()}${job.actionUrl}` : null;
  const result = await sendMail({
    to: job.to,
    toName: job.toName,
    subject: job.title,
    text: link ? `${job.body}\n\n${link}` : job.body,
    html: renderEmail(job.title, job.body, link),
  });
  if (!result.sent) return false;
  await prisma.notification.update({ where: { id: notificationId }, data: { sentAt: new Date() } });
  return true;
}

/**
 * Retries emails that never went out.
 *
 * Only rows from the last three days: an unsent renewal warning from last
 * month is stale, and arriving late would be worse than not arriving.
 */
export async function retryUnsentEmails(
  asOf = new Date(),
  limit = 50
): Promise<{ attempted: number; sent: number }> {
  const since = new Date(asOf.getTime() - 3 * 24 * 60 * 60 * 1000);
  const rows = await prisma.notification.findMany({
    where: { channel: { in: ["EMAIL", "BOTH"] }, sentAt: null, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: {
      user: {
        select: {
          email: true,
          member: { select: { name: true } },
          trainer: { select: { name: true } },
        },
      },
    },
  });

  let sent = 0;
  for (const r of rows) {
    const ok = await deliverEmail(r.id, {
      to: r.user.email,
      toName: r.user.member?.name ?? r.user.trainer?.name ?? null,
      title: r.title,
      body: r.body,
      actionUrl: r.actionUrl,
    });
    if (ok) sent += 1;
  }
  return { attempted: rows.length, sent };
}
