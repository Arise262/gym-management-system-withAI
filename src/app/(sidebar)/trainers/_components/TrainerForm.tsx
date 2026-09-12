"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CreateTrainer,
  UpdateTrainer,
  type AdminTrainer,
  type LoginDelivery,
  type TrainerFieldErrors,
  type TrainerInput,
} from "@/action/trainer-admin.action";
import { Field, FormErrorSummary } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { LoginNotice } from "./LoginNotice";
import { WEEK } from "./hours";

type Day = { on: boolean; start: string; end: string };

type Draft = {
  name: string;
  email: string;
  bio: string;
  specializations: string;
  certifications: string;
  hourlyRate: string;
  isAvailable: boolean;
  days: Record<number, Day>;
};

/** A new trainer starts on the gym's usual weekday shift; the admin adjusts from there. */
function initialDraft(t?: AdminTrainer): Draft {
  const days: Record<number, Day> = {};
  for (const d of WEEK) {
    const w = t?.availability.find((a) => a.dayOfWeek === d.dayOfWeek);
    days[d.dayOfWeek] = w
      ? { on: true, start: w.startTime, end: w.endTime }
      : { on: !t && d.dayOfWeek >= 1 && d.dayOfWeek <= 5, start: "09:00", end: "17:00" };
  }
  return {
    name: t?.name ?? "",
    email: t?.email ?? "",
    bio: t?.bio ?? "",
    specializations: t?.specializations.join(", ") ?? "",
    certifications: t?.certifications.join(", ") ?? "",
    hourlyRate: t ? String(t.hourlyRate) : "",
    isAvailable: t?.isAvailable ?? true,
    days,
  };
}

const splitList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

/**
 * Add or edit a trainer: the profile members browse, the weekly hours their
 * booking slots come from, and (for a new trainer) the login.
 */
export function TrainerForm({ trainer }: { trainer?: AdminTrainer }) {
  const router = useRouter();
  const editing = Boolean(trainer);
  const [draft, setDraft] = useState<Draft>(() => initialDraft(trainer));
  const [errors, setErrors] = useState<TrainerFieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ id: string; name: string; login: LoginDelivery }>();
  const summaryRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const setDay = (dayOfWeek: number, patch: Partial<Day>) => {
    setDraft((d) => ({ ...d, days: { ...d.days, [dayOfWeek]: { ...d.days[dayOfWeek], ...patch } } }));
    setErrors((e) => ({ ...e, availability: undefined }));
  };

  function clientErrors(): TrainerFieldErrors {
    const e: TrainerFieldErrors = {};
    if (!draft.name.trim()) e.name = "Enter the trainer's name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) e.email = "Enter a valid email address.";
    const rate = Number(draft.hourlyRate);
    if (!draft.hourlyRate.trim() || !Number.isInteger(rate) || rate < 0) e.hourlyRate = "Enter a whole number of pesos (0 or more).";
    for (const d of WEEK) {
      const day = draft.days[d.dayOfWeek];
      if (day.on && !(day.start && day.end && day.start < day.end)) e.availability = `${d.long}: the finish time must be after the start time.`;
    }
    return e;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const found = clientErrors();
    if (Object.values(found).some(Boolean)) {
      setErrors(found);
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    const input: TrainerInput = {
      name: draft.name,
      email: draft.email,
      bio: draft.bio,
      specializations: splitList(draft.specializations),
      certifications: splitList(draft.certifications),
      hourlyRate: Number(draft.hourlyRate),
      isAvailable: draft.isAvailable,
      availability: WEEK.filter((d) => draft.days[d.dayOfWeek].on).map((d) => ({
        dayOfWeek: d.dayOfWeek,
        startTime: draft.days[d.dayOfWeek].start,
        endTime: draft.days[d.dayOfWeek].end,
      })),
    };

    setSaving(true);
    setFormError(undefined);
    const res = trainer ? await UpdateTrainer(trainer.id, input) : await CreateTrainer(input);
    setSaving(false);

    if (!res.success) {
      setErrors(res.fieldErrors ?? {});
      setFormError(res.fieldErrors ? undefined : res.error);
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    if (editing) {
      toast.success("Trainer saved");
      router.refresh();
      return;
    }
    if (res.login?.emailed) {
      toast.success(`${draft.name.trim()} added — login details emailed`);
      router.push(`/trainers/${res.trainerId}`);
      return;
    }
    // The email did not go out: stay here, because leaving the page would lose
    // the only copy of the temporary password.
    setCreated({ id: res.trainerId, name: draft.name.trim(), login: res.login! });
  }

  if (created) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="font-display text-2xl font-semibold">{created.name} has been added</h2>
        <LoginNotice login={created.login} />
        <Button asChild className="w-fit">
          <Link href={`/trainers/${created.id}`}>Done — open their profile</Link>
        </Button>
      </div>
    );
  }

  const errorList = [...Object.values(errors).filter(Boolean), ...(formError ? [formError] : [])] as string[];

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <FormErrorSummary ref={summaryRef} errors={errorList} />

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>What members see when they browse trainers and book a session.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required error={errors.name} hint={editing ? "The trainer sees a new name after their next sign-in." : undefined}>
              {(p) => <Input {...p} value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Paolo Ramos" maxLength={80} autoComplete="off" />}
            </Field>
            <Field
              label="Email"
              required
              error={errors.email}
              hint={editing ? "This is their login. Changing it changes how they sign in." : "Their login. The temporary password is emailed here."}
            >
              {(p) => <Input {...p} type="email" value={draft.email} onChange={(e) => set("email", e.target.value)} placeholder="name@example.com" autoComplete="off" />}
            </Field>
          </div>

          <Field label="Bio" hint="Optional. A couple of sentences on how they coach.">
            {(p) => <Textarea {...p} rows={3} value={draft.bio} onChange={(e) => set("bio", e.target.value)} maxLength={1000} />}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Specialisations" hint="Separate with commas, e.g. strength, weight loss.">
              {(p) => <Input {...p} value={draft.specializations} onChange={(e) => set("specializations", e.target.value)} />}
            </Field>
            <Field label="Certifications" hint="Optional. Separate with commas.">
              {(p) => <Input {...p} value={draft.certifications} onChange={(e) => set("certifications", e.target.value)} />}
            </Field>
          </div>

          <Field label="Rate per session" required error={errors.hourlyRate} hint="Whole pesos for a one-hour session. Enter 0 if sessions are included.">
            {(p) => (
              <div className="relative sm:w-48">
                <span aria-hidden="true" className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                  ₱
                </span>
                <Input
                  {...p}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  className="pl-7"
                  value={draft.hourlyRate}
                  onChange={(e) => set("hourlyRate", e.target.value)}
                  placeholder="500"
                />
              </div>
            )}
          </Field>

          <div className="flex items-center gap-3">
            <Switch id="trainer-bookable" checked={draft.isAvailable} onCheckedChange={(v) => set("isAvailable", v)} />
            <Label htmlFor="trainer-bookable" className="font-normal">
              Members can book this trainer
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Weekly hours</CardTitle>
          <CardDescription>Members can book one-hour sessions inside these hours. Sessions already booked are kept if you change them.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {errors.availability && (
            <p role="alert" className="text-destructive mb-2 text-xs font-medium">
              {errors.availability}
            </p>
          )}
          {WEEK.map((d) => {
            const day = draft.days[d.dayOfWeek];
            const id = `day-${d.dayOfWeek}`;
            return (
              <div key={d.dayOfWeek} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-1.5">
                <div className="flex w-32 items-center gap-2">
                  <Checkbox id={id} checked={day.on} onCheckedChange={(v) => setDay(d.dayOfWeek, { on: v === true })} />
                  <Label htmlFor={id} className="font-normal">
                    {d.long}
                  </Label>
                </div>
                {day.on ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      aria-label={`${d.long} start`}
                      className="w-32"
                      value={day.start}
                      onChange={(e) => setDay(d.dayOfWeek, { start: e.target.value })}
                    />
                    <span className="text-muted-foreground text-sm">to</span>
                    <Input
                      type="time"
                      aria-label={`${d.long} finish`}
                      className="w-32"
                      value={day.end}
                      onChange={(e) => setDay(d.dayOfWeek, { end: e.target.value })}
                    />
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">Not working</span>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : editing ? "Save changes" : "Add trainer"}
        </Button>
        <Button type="button" variant="ghost" asChild>
          <Link href="/trainers">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
