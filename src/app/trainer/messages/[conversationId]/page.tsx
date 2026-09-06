import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { ChatView } from "@/components/chat-view";
import { GetMessages, GetTrainerConversations } from "@/action/chat.action";

export default async function TrainerThreadPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;

  const thread = (await GetTrainerConversations()).find((c) => c.id === conversationId);
  if (!thread) notFound();

  const messages = await GetMessages(conversationId);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <Link href="/trainer/messages">
          <Button variant="ghost" size="sm" className="-ml-2">
            <IconArrowLeft className="mr-1 size-4" />
            Messages
          </Button>
        </Link>
        <span className="font-medium">{thread.title}</span>
      </div>

      <ChatView
        conversationId={conversationId}
        mode="direct"
        initialMessages={messages}
        emptyState="No messages in this thread yet."
      />
    </div>
  );
}
