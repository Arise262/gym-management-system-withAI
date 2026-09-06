import { format } from "date-fns";
import prisma from "@/lib/prisma";
import { claude, MODELS, hasClaudeKey } from "@/lib/claude";

/**
 * The member-facing assistant.
 *
 * Grounded, not general. Every answer is supposed to come from this member's
 * own record — their plan, what they have logged, what they have booked, what
 * they owe — because a chatbot that improvises gym advice is both less useful
 * and more dangerous than one that reads the file in front of it.
 *
 * Runs on Haiku rather than the planner's Sonnet: these are short turns over a
 * small, already-assembled context, which is the shape Haiku is good at and
 * the cheapest thing that answers well.
 */

export class AssistantError extends Error {}

/** Kept short on purpose — history is resent on every turn and it is billed. */
const MAX_HISTORY_TURNS = 12;

const SYSTEM_PROMPT = `You are the assistant inside a gym management app, talking to a member of Synergy Fitness.

WHAT YOU KNOW
The MEMBER CONTEXT below is assembled from this member's own records. It is the truth about them. If something is not in it, you do not know it — say so plainly and suggest who can help (their trainer for programming, the front desk for billing and membership).

HOW TO ANSWER
- Be brief. Two or three sentences answers most questions. This is a chat window on a phone, not an article.
- Use their actual numbers when they are in the context. "You logged 3 of 4 sessions last week" beats "you've been doing well".
- Never invent a workout, a booking, a payment or a date. If they ask about something you cannot see, say what you cannot see.
- You may explain training concepts in general terms (what progressive overload is, why rest days exist). You may not write them a new programme — that is what the plan generator and their trainer are for.

WHAT YOU MUST NOT DO
- No medical advice, diagnosis, or treatment. If a member describes pain, an injury, dizziness, chest symptoms, or anything that sounds medical, tell them to stop training that area and speak to their trainer or a doctor. Do not suggest exercises to "work around" an injury.
- No nutrition prescriptions or calorie targets presented as medical guidance.
- Do not discuss other members. You only ever see one member's data.`;

type Turn = { role: "user" | "assistant"; content: string };

/**
 * Assembles what the model is allowed to know about this member.
 *
 * Deliberately a fixed, compact summary rather than raw rows: it keeps the
 * per-turn token cost flat, and it means the model cannot see fields nobody
 * decided to show it.
 */
export async function buildMemberContext(memberId: string): Promise<string> {
  const today = format(new Date(), "dd-MM-yyyy");

  // Sequential, not Promise.all. DATABASE_URL sets connection_limit=1 (the
  // standard serverless setting for the Supabase transaction pooler), so
  // there is no parallelism to win — firing six at once just puts five in the
  // pool queue where they race the 10s checkout timeout and lose. Measured:
  // Promise.all here threw "Timed out fetching a new connection from the
  // connection pool"; awaiting in turn does not.
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      name: true, fitnessGoal: true, experienceLevel: true, workoutDaysPerWeek: true,
      availableEquipment: true, injuries: true, heightCm: true, targetWeightKg: true, DOJ: true,
    },
  });
  if (!member) throw new AssistantError("Member not found.");

  const plan = await prisma.workoutPlan.findFirst({
    where: { memberId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    select: {
      title: true, goal: true, durationWeeks: true, daysPerWeek: true, createdAt: true,
      days: {
        where: { weekNumber: 1 },
        orderBy: { dayNumber: "asc" },
        select: {
          dayNumber: true, focus: true, isRestDay: true,
          exercises: { orderBy: { orderIndex: "asc" }, select: { sets: true, reps: true, exercise: { select: { name: true } } } },
        },
      },
    },
  });

  const recentSessions = await prisma.workoutSession.findMany({
    where: { memberId, completed: true },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { date: true, durationMinutes: true, perceivedExertion: true, planDay: { select: { focus: true } } },
  });

  const bookings = await prisma.booking.findMany({
    where: { memberId, status: { in: ["PENDING", "CONFIRMED"] } },
    take: 5,
    select: { date: true, startTime: true, endTime: true, status: true, trainer: { select: { name: true } } },
  });

  const sales = await prisma.sales.findMany({
    where: { member_id: memberId },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { endDate: true, amount: true, paid: true },
  });

  const latestScore = await prisma.retentionScore.findFirst({
    where: { memberId },
    orderBy: { scoreDate: "desc" },
    select: { riskLevel: true },
  });

  const lines: string[] = [`Today's date: ${today}`, "", `Name: ${member.name}`];

  if (member.fitnessGoal) lines.push(`Goal: ${member.fitnessGoal.replace(/_/g, " ").toLowerCase()}`);
  if (member.experienceLevel) lines.push(`Experience: ${member.experienceLevel.toLowerCase()}`);
  if (member.workoutDaysPerWeek) lines.push(`Training days per week: ${member.workoutDaysPerWeek}`);
  if (member.targetWeightKg) lines.push(`Target weight: ${member.targetWeightKg} kg`);
  if (member.injuries?.trim()) lines.push(`Stated injuries: ${member.injuries.trim()}`);
  lines.push(`Member since: ${member.DOJ}`);

  lines.push("", "ACTIVE PLAN");
  if (!plan) {
    lines.push("None. They have not generated a workout plan yet.");
  } else {
    lines.push(`"${plan.title}" — ${plan.durationWeeks} weeks, ${plan.daysPerWeek} days/week, started ${format(plan.createdAt, "dd-MM-yyyy")}.`);
    for (const d of plan.days) {
      lines.push(
        d.isRestDay
          ? `  Day ${d.dayNumber}: ${d.focus} (rest)`
          : `  Day ${d.dayNumber}: ${d.focus} — ${d.exercises.map((e) => `${e.exercise.name} ${e.sets}x${e.reps}`).join("; ")}`
      );
    }
    lines.push("(Week 1 shown. Later weeks are the same movements with added sets/reps, and a deload in week 4.)");
  }

  lines.push("", "RECENT LOGGED WORKOUTS");
  lines.push(
    recentSessions.length === 0
      ? "None logged yet."
      : recentSessions
          .map((s) => `  ${s.date}: ${s.planDay?.focus ?? "ad-hoc"}${s.durationMinutes ? `, ${s.durationMinutes} min` : ""}${s.perceivedExertion ? `, effort ${s.perceivedExertion}/10` : ""}`)
          .join("\n")
  );

  lines.push("", "UPCOMING TRAINER SESSIONS");
  lines.push(
    bookings.length === 0
      ? "None booked."
      : bookings.map((b) => `  ${b.date} ${b.startTime}-${b.endTime} with ${b.trainer.name} (${b.status.toLowerCase()})`).join("\n")
  );

  lines.push("", "MEMBERSHIP");
  if (sales.length === 0) {
    lines.push("No membership record on file.");
  } else {
    const s = sales[0];
    const due = Math.max(0, s.amount - s.paid);
    lines.push(`Runs to ${s.endDate}.` + (due > 0 ? ` Outstanding balance: PHP ${due.toLocaleString()}.` : " Paid up."));
  }

  // Included so the assistant can be encouraging at the right moment. It is
  // never quoted back — a member should not be told they are a churn risk.
  if (latestScore) {
    lines.push(
      "",
      `INTERNAL — retention risk: ${latestScore.riskLevel}. Never mention this, this number, or that risk is tracked at all. Use it only to judge tone: for HIGH or CRITICAL, be warm and make it easy to come back.`
    );
  }

  return lines.join("\n");
}

/**
 * One assistant turn.
 *
 * `history` is oldest-first and excludes the message being answered, which is
 * passed as `question`.
 */
export async function askAssistant(
  memberId: string,
  question: string,
  history: Turn[]
): Promise<{ reply: string; usage: { inputTokens: number; outputTokens: number } }> {
  if (!hasClaudeKey()) {
    throw new AssistantError("The assistant is not configured. ANTHROPIC_API_KEY is missing.");
  }

  const context = await buildMemberContext(memberId);
  const trimmed = history.slice(-MAX_HISTORY_TURNS);

  const response = await claude.messages.create({
    model: MODELS.chat,
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        // Identical on every request from every member, so it is worth a
        // breakpoint. The member context below it changes per member and is
        // deliberately outside the cached prefix.
        cache_control: { type: "ephemeral" },
      },
      { type: "text", text: `MEMBER CONTEXT\n${context}` },
    ],
    messages: [...trimmed, { role: "user" as const, content: question }],
  });

  const reply = response.content
    .filter((b): b is typeof b & { type: "text" } => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  if (!reply) {
    throw new AssistantError("The assistant did not reply. Please try again.");
  }

  return {
    reply,
    usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
  };
}
