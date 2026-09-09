"use client";

import * as React from "react";
import { toast } from "sonner";
import { IconSend, IconSparkles } from "@tabler/icons-react";
import {
  GetMessages,
  MarkConversationRead,
  SendAssistantMessage,
  SendMessage,
  type ChatMessage,
} from "@/action/chat.action";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/**
 * One chat thread.
 *
 * `assistant` mode talks to the model and does not poll — nobody else can add
 * to that thread, so there is nothing to poll for. `direct` mode polls, because
 * the other person's messages arrive out of band.
 */
export type ChatMode = "assistant" | "direct";

/** How often a direct thread checks for new messages while it is on screen. */
const POLL_MS = 4000;

export function ChatView({
  conversationId,
  mode,
  initialMessages,
  emptyState,
  suggestions = [],
}: {
  conversationId: string;
  mode: ChatMode;
  initialMessages: ChatMessage[];
  emptyState: React.ReactNode;
  /**
   * Starter prompts shown only on an empty thread. A blank chat box tells the
   * member nothing about what the assistant can actually answer, so most people
   * either type nothing or ask it something it has no data for.
   */
  suggestions?: string[];
}) {
  const [messages, setMessages] = React.useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const scrollDown = React.useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  React.useEffect(() => {
    scrollDown();
  }, [messages.length, scrollDown]);

  React.useEffect(() => {
    void MarkConversationRead(conversationId);
  }, [conversationId, messages.length]);

  /** Fetches only what is newer than the last message already held. */
  const pull = React.useCallback(async () => {
    const newest = messages[messages.length - 1]?.id;
    try {
      const fresh = await GetMessages(conversationId, newest);
      if (fresh.length) setMessages((prev) => [...prev, ...fresh]);
    } catch {
      // A failed poll is not worth interrupting the member over — the next
      // tick will pick the messages up.
    }
  }, [conversationId, messages]);

  React.useEffect(() => {
    if (mode !== "direct") return;

    const tick = () => {
      // Polling a hidden tab burns database reads on a free tier for messages
      // nobody is looking at. Resume on focus instead.
      if (document.visibilityState === "visible") void pull();
    };
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [mode, pull]);

  async function send() {
    const content = draft.trim();
    if (!content || sending) return;

    setSending(true);
    setDraft("");

    const fd = new FormData();
    fd.set("conversationId", conversationId);
    fd.set("content", content);

    const result =
      mode === "assistant"
        ? await SendAssistantMessage(null, fd)
        : await SendMessage(null, fd);

    if (!result.success) {
      toast.error(result.error);
      // Give the text back only if nothing was stored. In assistant mode the
      // member's message is written before the model is called, so it is
      // already in the thread and restoring the draft would duplicate it.
      if (mode === "direct") setDraft(content);
    }

    // Refetch either way: in assistant mode a failed reply still leaves the
    // member's own message on the server, and the thread should show it.
    try {
      const all = await GetMessages(conversationId);
      setMessages(all);
    } catch {
      /* leave what is on screen */
    }
    setSending(false);
  }

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col gap-3">
      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          // Centred in the scroll area rather than pinned to the top of it —
          // the old layout left a ~500px void between the intro line and the
          // composer.
          <div className="flex h-full flex-col items-center justify-center gap-4 px-2 text-center">
            <span className="bg-brand/10 text-brand flex size-12 items-center justify-center rounded-full">
              <IconSparkles className="size-6" aria-hidden="true" />
            </span>
            <div className="text-muted-foreground max-w-sm text-sm text-balance">{emptyState}</div>
            {suggestions.length > 0 && (
              <ul className="flex flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => setDraft(s)}
                      className="border-border hover:border-brand/50 hover:bg-accent focus-visible:ring-ring cursor-pointer rounded-full border px-3 py-1.5 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          messages.map((m) => <Bubble key={m.id} m={m} />)
        )}
        {sending && mode === "assistant" && (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <IconSparkles className="size-4 animate-pulse" />
            Thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-end gap-2 border-t pt-3">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter is a newline. Standard for chat, and it
            // matters on mobile where the send button is a reach.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          maxLength={2000}
          placeholder={mode === "assistant" ? "Ask about your plan, bookings or membership…" : "Write a message…"}
          className="min-h-0 resize-none"
          disabled={sending}
        />
        <Button onClick={() => void send()} disabled={sending || !draft.trim()} size="icon" className="size-10 shrink-0">
          <IconSend className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function Bubble({ m }: { m: ChatMessage }) {
  const isAssistant = m.role === "ASSISTANT";
  const mine = m.mine;

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        // The assistant and a human trainer used to render identically (both
        // branches of the ternary were "bg-muted"), so in a thread you could
        // not tell a generated reply from a person's. The assistant now carries
        // a brand-tinted edge.
        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
          mine
            ? "bg-primary text-primary-foreground"
            : isAssistant
              ? "bg-brand/5 border-brand/20 border"
              : "bg-muted"
        }`}
      >
        {!mine && (
          <div className="text-muted-foreground mb-0.5 flex items-center gap-1 text-xs font-medium">
            {isAssistant && <IconSparkles className="size-3" />}
            {isAssistant ? "Assistant" : (m.senderName ?? "Them")}
          </div>
        )}
        {m.content}
        <div className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}
