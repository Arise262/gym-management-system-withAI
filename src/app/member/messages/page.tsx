import Link from "next/link";
import { IconArrowLeft, IconMessage } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConversationList } from "@/components/conversation-list";
import { GetMyConversations } from "@/action/chat.action";

export const metadata = { title: "Messages" };

export default async function MemberMessagesPage() {
  const all = await GetMyConversations();
  // The assistant lives on its own page; this list is people.
  const threads = all.filter((c) => c.type !== "AI_ASSISTANT");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <Link href="/member">
          <Button variant="ghost" size="sm" className="-ml-2">
            <IconArrowLeft className="mr-1 size-4" />
            Back
          </Button>
        </Link>
        <Link href="/member/trainers">
          <Button variant="ghost" size="sm">
            <IconMessage className="mr-1 size-4" />
            Find a trainer
          </Button>
        </Link>
      </div>

      <h1 className="text-2xl font-semibold">Messages</h1>

      {threads.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No conversations yet</CardTitle>
            <CardDescription>
              Open a trainer&apos;s profile and press Message to start one.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ConversationList conversations={threads} basePath="/member/messages" />
      )}
    </div>
  );
}
