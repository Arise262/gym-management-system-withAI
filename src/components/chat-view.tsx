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
}: {
  conversationId: string;
  mode: ChatMode;
  initialMessages: ChatMessage[];
  emptyState: React.ReactNode;
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
          <div className="text-muted-foreground py-10 text-center text-sm">{emptyState}</div>
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
        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
          mine
            ? "bg-primary text-primary-foreground"
            : isAssistant
              ? "bg-muted"
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
