import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConversationList } from "@/components/conversation-list";
import { GetTrainerConversations } from "@/action/chat.action";

export const metadata = { title: "Messages" };

export default async function TrainerMessagesPage() {
  const threads = (await GetTrainerConversations()).filter((c) => c.type !== "AI_ASSISTANT");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <Link href="/trainer">
        <Button variant="ghost" size="sm" className="-ml-2">
          <IconArrowLeft className="mr-1 size-4" />
          Trainer area
        </Button>
      </Link>

      <h1 className="text-2xl font-semibold">Messages</h1>

      {threads.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No conversations yet</CardTitle>
            <CardDescription>Members who message you will appear here.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ConversationList conversations={threads} basePath="/trainer/messages" />
      )}
    </div>
  );
}
