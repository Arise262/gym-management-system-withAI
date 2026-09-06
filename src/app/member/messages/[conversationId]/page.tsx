import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { ChatView } from "@/components/chat-view";
import { GetMessages, GetMyConversations } from "@/action/chat.action";

export default async function MemberThreadPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;

  // Sourcing the title from the caller's own thread list doubles as the
  // access check: a conversation they are not in is simply not there.
  const thread = (await GetMyConversations()).find((c) => c.id === conversationId);
  if (!thread) notFound();

  const messages = await GetMessages(conversationId);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <Link href="/member/messages">
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
        emptyState="Say hello — your trainer will see this next time they open their messages."
      />
    </div>
  );
}
