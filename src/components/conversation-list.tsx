import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ConversationSummary } from "@/action/chat.action";

/** Threads, most recent first, with an unread dot. */
export function ConversationList({
  conversations,
  basePath,
}: {
  conversations: ConversationSummary[];
  basePath: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {conversations.map((c) => (
        <Link key={c.id} href={`${basePath}/${c.id}`}>
          <Card className="transition hover:bg-muted/50">
            <CardContent className="flex items-center justify-between gap-3 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.title}</span>
                  {c.unread && <Badge className="bg-primary h-2 w-2 rounded-full p-0" />}
                </div>
                <p className="text-muted-foreground truncate text-sm">
                  {c.preview ?? "No messages yet"}
                </p>
              </div>
              <span className="text-muted-foreground shrink-0 text-xs">
                {new Date(c.lastMessageAt).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
