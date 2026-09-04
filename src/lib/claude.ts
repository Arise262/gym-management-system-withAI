import Anthropic from "@anthropic-ai/sdk";

/**
 * Shared Anthropic client.
 *
 * Reads ANTHROPIC_API_KEY from the environment. Kept on globalThis in dev so
 * Next.js hot reloads don't leak a new client (and a new connection pool) on
 * every edit — same reason src/lib/prisma.ts does it.
 */
const globalForClaude = global as unknown as { claude?: Anthropic };

export const claude = globalForClaude.claude ?? new Anthropic();

if (process.env.NODE_ENV !== "production") globalForClaude.claude = claude;

/**
 * Model per task. Both are deliberately below the claude-opus-5 default:
 * the workload is structured generation from a supplied candidate list and
 * short conversational turns, neither of which needs Opus-tier reasoning,
 * and this project is cost-constrained.
 */
export const MODELS = {
  /** Workout plan generation — structured output over a filtered exercise list. */
  planner: "claude-sonnet-5",
  /** Support chatbot — short turns over the member's own data. */
  chat: "claude-haiku-4-5",
} as const;

/** True when a key is configured. Lets callers fail with a clear message. */
export function hasClaudeKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}
