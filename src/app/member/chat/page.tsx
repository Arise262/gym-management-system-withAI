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
      <div className="flex items-center justify-between">
        <Link href="/member">
          <Button variant="ghost" size="sm" className="-ml-2">
            <IconArrowLeft className="mr-1 size-4" />
            Back
          </Button>
        </Link>
        <div className="text-muted-foreground flex items-center gap-1 text-sm">
          <IconSparkles className="size-4" />
          Assistant
        </div>
      </div>

      <ChatView
        conversationId={conversationId}
        mode="assistant"
        initialMessages={messages}
        emptyState={
          <div className="flex flex-col gap-2">
            <p>Ask about your plan, your logged workouts, your bookings or your membership.</p>
            <p className="text-xs">
              It reads your own records only. For anything medical, talk to your trainer or a doctor.
            </p>
          </div>
        }
      />
    </div>
  );
}
