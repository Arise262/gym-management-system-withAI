"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IconMessage } from "@tabler/icons-react";
import { GetOrCreateTrainerConversation } from "@/action/chat.action";
import { Button } from "@/components/ui/button";

/**
 * Opens the member's thread with a trainer, creating it on first press.
 *
 * The conversation is created on the way in rather than when the first message
 * is sent, so the member lands in a real thread they can see and come back to
 * even if they change their mind about what to say.
 */
export function MessageTrainerButton({
  trainerId,
  variant = "outline",
  label = "Message",
}: {
  trainerId: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  label?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      variant={variant}
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            const id = await GetOrCreateTrainerConversation(trainerId);
            router.push(`/member/messages/${id}`);
          } catch {
            toast.error("Could not open that conversation.");
          }
        })
      }
    >
      <IconMessage className="mr-1 size-4" />
      {pending ? "Opening…" : label}
    </Button>
  );
}
