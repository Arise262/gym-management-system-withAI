"use client";

import { useState } from "react";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import type { LoginDelivery } from "@/action/trainer-admin.action";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Tells the admin how the trainer's temporary password reached them. Normally
 * it was emailed and the admin never sees it; if the email could not go out,
 * this is the one time it is shown — it is not stored anywhere readable.
 */
export function LoginNotice({ login }: { login: LoginDelivery }) {
  const [copied, setCopied] = useState(false);

  if (login.emailed) {
    return (
      <Alert>
        <IconCheck />
        <AlertTitle>Login details emailed</AlertTitle>
        <AlertDescription>
          A temporary password was sent to {login.email}. The trainer should change it after signing in.
        </AlertDescription>
      </Alert>
    );
  }

  async function copy() {
    if (login.emailed) return;
    try {
      await navigator.clipboard.writeText(login.tempPassword);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Alert className="border-amber-500/60">
      <AlertTitle>{login.reason} Give the trainer these details in person:</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <p>
          Email: <span className="text-foreground font-medium">{login.email}</span>
        </p>
        <p className="flex flex-wrap items-center gap-2">
          Temporary password:{" "}
          <code className="bg-muted text-foreground rounded px-2 py-0.5 font-mono text-sm">{login.tempPassword}</code>
          <Button type="button" size="sm" variant="outline" onClick={copy}>
            {copied ? <IconCheck className="size-4" /> : <IconCopy className="size-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </p>
        <p>This is the only time it is shown. If it gets lost, use Send new password.</p>
      </AlertDescription>
    </Alert>
  );
}
