"use client";

import { useState } from "react";
import type { WalkInRate } from "@prisma/client";
import { toast } from "sonner";
import { AddWalkIn, CheckInWithPass, type ActivePass, type WalkInRow } from "@/action/walk-in.action";
import { Field } from "@/components/form-field";
import { PaidBadge } from "@/components/paid-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatAppDate, pesos } from "@/lib/format";
import { WALK_IN_RATES, WALK_IN_RATE_KEYS, normaliseName } from "@/lib/walk-in";

const ON = "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground";

/**
 * Records a non-member: one session, or a 7-day pass whose later visits are
 * covered automatically.
 *
 * Pass holders are listed above the form for a one-tap check-in. Typing a pass
 * holder's name works too — the server matches it and covers the visit rather
 * than charging again — and the form says so before it is submitted.
 *
 * Non-student is preselected: it is the full session price, and the student
 * rate is the discount the desk opts into after seeing an ID.
 */
export function WalkInForm({
  passes,
  onAdded,
}: {
  passes: ActivePass[];
  onAdded: (walkIn: WalkInRow) => void;
}) {
  const [name, setName] = useState("");
  const [rate, setRate] = useState<WalkInRate>("REGULAR");
  const [paid, setPaid] = useState(true);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState<string>();

  const typed = normaliseName(name).toLowerCase();
  const match = typed ? passes.find((p) => p.name.toLowerCase() === typed) : undefined;

  function done(res: Awaited<ReturnType<typeof AddWalkIn>>) {
    if (!res.success) return setError(res.error);
    toast.success(res.message);
    setName("");
    setPaid(true);
    setRate("REGULAR");
    onAdded(res.walkIn);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Enter the walk-in's name.");
    setError(undefined);
    setSaving("form");
    const res = await AddWalkIn({ name, rate, paid });
    setSaving(undefined);
    done(res);
  }

  async function checkInPass(p: ActivePass) {
    setError(undefined);
    setSaving(p.id);
    const res = await CheckInWithPass(p.id);
    setSaving(undefined);
    if (!res.success) return toast.error(res.error);
    toast.success(res.message);
    onAdded(res.walkIn);
  }

  const submitLabel = match
    ? `Check in on ${match.name}'s weekly pass`
    : rate === "WEEKLY"
      ? `Sell weekly pass · ${pesos(WALK_IN_RATES.WEEKLY.price)}`
      : `Check in walk-in · ${pesos(WALK_IN_RATES[rate].price)}`;

  return (
    <div className="flex flex-col gap-5">
      {passes.length > 0 && (
        <section aria-labelledby="pass-holders" className="flex flex-col gap-2">
          <h3 id="pass-holders" className="text-sm font-medium">
            Weekly pass holders
          </h3>
          <ul className="divide-border/70 divide-y rounded-lg border">
            {passes.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-muted-foreground text-xs">Until {formatAppDate(p.validUntil, "EEE d MMM")}</p>
                </div>
                {!p.paid && <PaidBadge paid={false} />}
                <Button
                  size="sm"
                  variant={p.checkedInToday ? "ghost" : "outline"}
                  disabled={p.checkedInToday || saving === p.id}
                  onClick={() => checkInPass(p)}
                >
                  {p.checkedInToday ? "In today" : saving === p.id ? "Checking in…" : "Check in"}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field
          label="Name"
          required
          error={error}
          hint={
            match
              ? `${match.name} has a weekly pass until ${formatAppDate(match.validUntil)} — this visit is covered, nothing to pay.`
              : undefined
          }
        >
          {(p) => (
            <Input
              {...p}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Juan Dela Cruz"
              autoComplete="off"
              maxLength={80}
            />
          )}
        </Field>

        {!match && (
          <>
            <fieldset className="space-y-1.5">
              <legend className="text-sm leading-none font-medium">Rate</legend>
              <ToggleGroup
                type="single"
                variant="outline"
                value={rate}
                // Radix clears the value when the active item is pressed again;
                // a walk-in always has a rate, so ignore the empty string.
                onValueChange={(v) => v && setRate(v as WalkInRate)}
                className="mt-1.5 w-full flex-wrap sm:flex-nowrap"
              >
                {WALK_IN_RATE_KEYS.map((key) => (
                  <ToggleGroupItem key={key} value={key} className={ON}>
                    {key === "WEEKLY" ? "7 days" : WALK_IN_RATES[key].label} · {pesos(WALK_IN_RATES[key].price)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              {rate === "WEEKLY" && (
                <p className="text-muted-foreground text-xs">
                  Covers today and the next 6 days. Their later visits are checked in free from the list above.
                </p>
              )}
            </fieldset>

            <fieldset className="space-y-1.5">
              <legend className="text-sm leading-none font-medium">Payment</legend>
              <ToggleGroup
                type="single"
                variant="outline"
                value={paid ? "paid" : "unpaid"}
                onValueChange={(v) => v && setPaid(v === "paid")}
                className="mt-1.5 w-full sm:w-80"
              >
                <ToggleGroupItem value="paid" className={ON}>
                  Paid cash
                </ToggleGroupItem>
                <ToggleGroupItem value="unpaid" className={ON}>
                  Not yet paid
                </ToggleGroupItem>
              </ToggleGroup>
            </fieldset>
          </>
        )}

        <Button type="submit" disabled={saving === "form"} className="self-start">
          {saving === "form" ? "Saving…" : submitLabel}
        </Button>
      </form>
    </div>
  );
}
