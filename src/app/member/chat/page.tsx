import Link from "next/link";
import { IconArrowLeft, IconSparkles } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { ChatView } from "@/components/chat-view";
import { GetMessages, GetOrCreateAssistantConversation } from "@/action/chat.action";

export const metadata = { title: "Assistant" };

export default async function AssistantPage() {
  const conversationId = await GetOrCreateAssistantConversation();
  const messages = await GetMessages(conversationId);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3 p-4">
      {/* The page title was the smallest, faintest thing on the screen — muted
          grey text pushed to the right while "Back" took the emphasis. */}
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="-ml-2 shrink-0">
          <Link href="/member" aria-label="Back to your dashboard">
            <IconArrowLeft className="size-4" />
          </Link>
        </Button>
        <span className="bg-brand/10 text-brand flex size-8 shrink-0 items-center justify-center rounded-full">
          <IconSparkles className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-xl leading-none font-semibold">Assistant</h1>
          <p className="text-muted-foreground truncate text-xs">Grounded in your own records</p>
        </div>
      </div>

      <ChatView
        conversationId={conversationId}
        mode="assistant"
        initialMessages={messages}
        suggestions={[
          "What's my workout today?",
          "How many sessions did I do this month?",
          "When does my membership end?",
          "Do I owe anything?",
        ]}
        emptyState={
          <div className="flex flex-col gap-2">
            <p className="text-foreground text-base font-medium">Ask about your training</p>
            <p>
              Your plan, your logged workouts, your bookings and your membership. It reads your own
              records only — for anything medical, talk to your trainer or a doctor.
            </p>
          </div>
        }
      />
    </div>
  );
}
