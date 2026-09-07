"use client";

import * as React from "react";
import { useActionState } from "react";
import { IconSend } from "@tabler/icons-react";
import { SendAnnouncement, type AnnouncementResult } from "@/action/notification.action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * "Announce to my members" — used by trainers (their clients) and admins (the
 * whole gym). Who receives it is decided server-side from the session; this
 * form only carries the text.
 */
export function AnnouncementForm({
  audience,
  mailConfigured,
}: {
  audience: string;
  mailConfigured: boolean;
}) {
  const [state, action, pending] = useActionState<AnnouncementResult | null, FormData>(
    SendAnnouncement,
    null
  );
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send an announcement</CardTitle>
        <CardDescription>Goes to {audience}. It appears in their notifications panel right away.</CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={action} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ann-title">Title</Label>
            <Input id="ann-title" name="title" maxLength={120} placeholder="Saturday class moved to 9am" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ann-body">Message</Label>
            <Textarea
              id="ann-body"
              name="body"
              maxLength={2000}
              rows={4}
              placeholder="What do your members need to know?"
              required
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="email" disabled={!mailConfigured} />
            <span className={mailConfigured ? "" : "text-muted-foreground"}>
              Also send by email{mailConfigured ? "" : " (email is not configured yet)"}
            </span>
          </label>

          {state && !state.success && <p className="text-sm text-red-600">{state.error}</p>}
          {state?.success && (
            <p className="text-sm text-emerald-600">
              Sent to {state.recipients} member{state.recipients === 1 ? "" : "s"}
              {state.emailed > 0 ? `, ${state.emailed} by email` : ""}.
            </p>
          )}

          <Button type="submit" disabled={pending} className="w-fit">
            <IconSend className="mr-1 size-4" />
            {pending ? "Sending…" : "Send"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
