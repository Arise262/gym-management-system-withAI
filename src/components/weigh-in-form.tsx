"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogWeighIn, type ActionResult } from "@/action/nutrition.action";

/**
 * One-field weigh-in. Logging again the same day replaces that day's entry,
 * so a typo is fixed by simply entering the right number.
 */
export function WeighInForm({ loggedToday, lastWeightKg }: { loggedToday: boolean; lastWeightKg: number | null }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(LogWeighIn, null);

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      toast.success("Weigh-in saved.");
      formRef.current?.reset();
      router.refresh();
    } else {
      toast.error(state.error);
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-2">
      <div className="space-y-1.5">
        <Label htmlFor="weigh-in">{loggedToday ? "Correct today's weight (kg)" : "Log today's weight (kg)"}</Label>
        <Input
          id="weigh-in"
          name="weightKg"
          type="number"
          inputMode="decimal"
          step="0.1"
          min={25}
          max={400}
          required
          placeholder={lastWeightKg ? String(lastWeightKg) : "e.g. 72.5"}
          className="w-36"
        />
      </div>
      <Button type="submit" disabled={pending} variant="secondary">
        {pending ? "Saving…" : "Save"}
      </Button>
      {state && !state.success && (
        <p role="alert" className="text-destructive basis-full text-sm">{state.error}</p>
      )}
    </form>
  );
}
