"use server";

import { revalidatePath } from "next/cache";
import type { ConversationType } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireRole, requireUser } from "@/lib/session";
import { askAssistant, AssistantError } from "@/ai/assistant";

/**
 * Chat.
 *
 * Two kinds share one table: AI_ASSISTANT (a member and the model) and
 * MEMBER_TRAINER (two people). Everything below gates on being a
 * ConversationParticipant rather than on role, because that is the thing that
 * is actually true — a trainer has no business in a conversation they are not
 * in, and neither does an admin.
 *
 * Delivery is by polling, not Supabase Realtime. Realtime pushes row payloads
 * to the browser under the anon key, gated by Postgres RLS — and this schema is
 * Prisma-managed with Auth.js, so Supabase has no idea who the caller is and
 * there are no policies on Message. Without RLS every member could subscribe to
 * everyone's messages; with RLS and no policy, nothing is delivered. Polling
 * goes through these actions, which know who is asking.
 */

export type ChatActionResult =
  | { success: true; messageId: string }
  | { success: false; error: string };

export type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt: string;
  senderId: string | null;
  senderName: string | null;
  /** True when the signed-in user wrote it — drives which side it sits on. */
  mine: boolean;
};

/** Throws unless the caller is in this conversation. */
async function requireParticipant(conversationId: string, userId: string) {
  const seat = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { id: true },
  });
  if (!seat) throw new Error("You are not part of that conversation.");
  return seat;
}

/* ──────────────────────────── AI assistant ──────────────────────────── */

/**
 * The member's assistant thread, created on first use.
 *
 * One per member, reused forever — the history is the point. A new thread per
 * visit would throw away the context that makes the second question cheap.
 */
export async function GetOrCreateAssistantConversation(): Promise<string> {
  const user = await requireUser();

  const existing = await prisma.conversation.findFirst({
    where: { type: "AI_ASSISTANT", participants: { some: { userId: user.id } } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.conversation.create({
    data: {
      type: "AI_ASSISTANT",
      title: "Assistant",
      participants: { create: { userId: user.id } },
    },
    select: { id: true },
  });
  return created.id;
}

const sendSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().trim().min(1, "Type a message first.").max(2000),
});

/**
 * Asks the assistant and stores both sides of the exchange.
 *
 * The member's message is written before the model is called, so a failed or
 * slow call cannot lose what they typed — they can retry against a thread that
 * already contains their question.
 */
export async function SendAssistantMessage(
  _prev: ChatActionResult | null,
  formData: FormData
): Promise<ChatActionResult> {
  const user = await requireUser();
  if (!user.memberId) {
    return { success: false, error: "Only members have an assistant thread." };
  }

  const parsed = sendSchema.safeParse({
    conversationId: formData.get("conversationId"),
    content: formData.get("content"),
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const { conversationId, content } = parsed.data;

  try {
    await requireParticipant(conversationId, user.id);
  } catch {
    return { success: false, error: "You are not part of that conversation." };
  }

  const prior = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true },
  });

  const userMessage = await prisma.message.create({
    data: { conversationId, senderId: user.id, role: "USER", content },
  });

  try {
    const history = prior
      .filter((m) => m.role === "USER" || m.role === "ASSISTANT")
      .map((m) => ({ role: m.role === "USER" ? ("user" as const) : ("assistant" as const), content: m.content }));

    const { reply, usage } = await askAssistant(user.memberId, content, history);

    await prisma.$transaction([
      prisma.message.create({
        data: { conversationId, senderId: null, role: "ASSISTANT", content: reply },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      }),
    ]);

    console.info(`[assistant] ${usage.inputTokens} in / ${usage.outputTokens} out`);
    revalidatePath("/member/chat");
    return { success: true, messageId: userMessage.id };
  } catch (e) {
    console.error("SendAssistantMessage failed:", e);
    // The member's message survives; only the reply is missing. Saying so is
    // better than a silent thread, and better than deleting what they typed.
    return {
      success: false,
      error:
        e instanceof AssistantError
          ? e.message
          : "The assistant could not reply just now. Your message was saved — try asking again.",
    };
  }
}

/* ─────────────────────────── member ↔ trainer ─────────────────────────── */

/** The member's thread with one trainer, created on first message. */
export async function GetOrCreateTrainerConversation(trainerId: string): Promise<string> {
  const user = await requireUser();

  const trainer = await prisma.trainer.findUnique({
    where: { id: trainerId },
    select: { userId: true, name: true },
  });
  if (!trainer) throw new Error("That trainer does not exist.");

  const existing = await prisma.conversation.findFirst({
    where: {
      type: "MEMBER_TRAINER",
      AND: [
        { participants: { some: { userId: user.id } } },
        { participants: { some: { userId: trainer.userId } } },
      ],
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.conversation.create({
    data: {
      type: "MEMBER_TRAINER",
      title: trainer.name,
      participants: { create: [{ userId: user.id }, { userId: trainer.userId }] },
    },
    select: { id: true },
  });
  return created.id;
}

/** Posts a message from one person to another. No model involved. */
export async function SendMessage(
  _prev: ChatActionResult | null,
  formData: FormData
): Promise<ChatActionResult> {
  const user = await requireUser();

  const parsed = sendSchema.safeParse({
    conversationId: formData.get("conversationId"),
    content: formData.get("content"),
  });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const { conversationId, content } = parsed.data;

  try {
    await requireParticipant(conversationId, user.id);
  } catch {
    return { success: false, error: "You are not part of that conversation." };
  }

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: { conversationId, senderId: user.id, role: "USER", content },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    }),
  ]);

  revalidatePath("/member/messages");
  revalidatePath("/trainer/messages");
  return { success: true, messageId: message.id };
}

/* ─────────────────────────────── reading ─────────────────────────────── */

/**
 * Messages in a conversation.
 *
 * `afterId` makes this the polling endpoint: pass the newest id you already
 * have and only later messages come back, so a thread left open all afternoon
 * does not re-download itself every few seconds.
 */
export async function GetMessages(
  conversationId: string,
  afterId?: string
): Promise<ChatMessage[]> {
  const user = await requireUser();
  await requireParticipant(conversationId, user.id);

  let after: Date | undefined;
  if (afterId) {
    const anchor = await prisma.message.findUnique({
      where: { id: afterId },
      select: { createdAt: true, conversationId: true },
    });
    // Ignore an anchor from another conversation rather than leaking that it
    // exists — the caller simply gets the full thread.
    if (anchor && anchor.conversationId === conversationId) after = anchor.createdAt;
  }

  const rows = await prisma.message.findMany({
    where: { conversationId, ...(after ? { createdAt: { gt: after } } : {}) },
    orderBy: { createdAt: "asc" },
    // User has no name column — names live on Member/Trainer, so both are
    // pulled and whichever exists is used.
    include: {
      sender: {
        select: {
          id: true,
          email: true,
          member: { select: { name: true } },
          trainer: { select: { name: true } },
        },
      },
    },
  });

  return rows.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
    senderId: m.senderId,
    senderName: m.sender?.member?.name ?? m.sender?.trainer?.name ?? m.sender?.email ?? null,
    mine: m.senderId === user.id,
  }));
}

export type ConversationSummary = {
  id: string;
  type: ConversationType;
  title: string;
  lastMessageAt: string;
  preview: string | null;
  unread: boolean;
};

/** Every thread the caller is in, most recent first. */
export async function GetMyConversations(): Promise<ConversationSummary[]> {
  const user = await requireUser();

  const seats = await prisma.conversationParticipant.findMany({
    where: { userId: user.id },
    select: {
      lastReadAt: true,
      conversation: {
        select: {
          id: true, type: true, title: true, lastMessageAt: true,
          messages: { orderBy: { createdAt: "desc" }, take: 1, select: { content: true } },
          participants: {
            where: { userId: { not: user.id } },
            select: {
              user: {
                select: {
                  email: true,
                  member: { select: { name: true } },
                  trainer: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  return seats
    .map(({ conversation: c, lastReadAt }) => ({
      id: c.id,
      type: c.type,
      // Fall back to the other person's name so a thread is never "Untitled".
      title:
        c.title ??
        c.participants[0]?.user.member?.name ??
        c.participants[0]?.user.trainer?.name ??
        c.participants[0]?.user.email ??
        "Conversation",
      lastMessageAt: c.lastMessageAt.toISOString(),
      preview: c.messages[0]?.content.slice(0, 90) ?? null,
      unread: lastReadAt ? c.lastMessageAt > lastReadAt : c.messages.length > 0,
    }))
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

/** Clears the unread badge for the caller. */
export async function MarkConversationRead(conversationId: string): Promise<void> {
  const user = await requireUser();
  await prisma.conversationParticipant.updateMany({
    where: { conversationId, userId: user.id },
    data: { lastReadAt: new Date() },
  });
}

/** Trainer-side thread list. Same data, but proves the trainer role first. */
export async function GetTrainerConversations(): Promise<ConversationSummary[]> {
  await requireRole("TRAINER");
  return GetMyConversations();
}
