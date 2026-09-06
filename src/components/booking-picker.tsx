"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IconCalendarPlus, IconLock } from "@tabler/icons-react";
import { CreateBooking, GetTrainerSlots } from "@/action/booking.action";
import type { Slot } from "@/lib/booking-slots";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Trainer = {
  id: string;
  name: string;
  bio: string | null;
  hourlyRate: number;
  specializations: string[];
  availability: { dayOfWeek: number; startTime: string; endTime: string }[];
};

const DAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "dd-MM-yyyy", the format every date column in this app uses. */
function toGymDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/**
 * Booking picker.
 *
 * Shows the next two weeks, with days the trainer does not work greyed out
 * rather than hidden — a member should be able to see that Tuesday is not an
 * option, not wonder why Tuesday is missing.
 */
export function BookingPicker({ trainer, initialDate, initialSlots }: {
  trainer: Trainer;
  initialDate: string;
  initialSlots: Slot[];
}) {
  const router = useRouter();
  const [state, formAction, submitting] = useActionState(CreateBooking, null);
  const [loading, startLoading] = useTransition();

  const [date, setDate] = useState(initialDate);
  const [slots, setSlots] = useState<Slot[]>(initialSlots);
  const [picked, setPicked] = useState<string | null>(null);

  const worksOn = new Set(trainer.availability.map((a) => a.dayOfWeek));

  // The next 14 days, today first.
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    return d;
  });

  function chooseDate(d: Date) {
    const gym = toGymDate(d);
    setDate(gym);
    setPicked(null);
    startLoading(async () => {
      const res = await GetTrainerSlots(trainer.id, gym);
      setSlots(res?.slots ?? []);
    });
  }

  useEffect(() => {
    if (state?.success) {
      toast.success("Booking requested — your trainer will confirm it.");
      router.push("/member/bookings");
      router.refresh();
    } else if (state && !state.success) {
      toast.error(state.error);
      // The slot list is stale whenever a booking is refused: someone else may
      // have taken it. Refetch so the member sees the real state, not the one
      // they just failed against.
      startLoading(async () => {
        const res = await GetTrainerSlots(trainer.id, date);
        setSlots(res?.slots ?? []);
        setPicked(null);
      });
    }
  }, [state, router, trainer.id, date]);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{trainer.name}</CardTitle>
          <CardDescription>₱{trainer.hourlyRate.toLocaleString()} per hour</CardDescription>
          {trainer.specializations.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {trainer.specializations.map((s) => (
                <Badge key={s} variant="secondary" className="capitalize">{s}</Badge>
              ))}
            </div>
          )}
        </CardHeader>
        {trainer.bio && (
          <CardContent>
            <p className="text-muted-foreground text-sm">{trainer.bio}</p>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pick a day</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {days.map((d) => {
              const gym = toGymDate(d);
              const works = worksOn.has(d.getDay());
              const selected = gym === date;
              return (
                <button
                  key={gym}
                  type="button"
                  disabled={!works}
                  onClick={() => chooseDate(d)}
                  className={`flex min-w-[64px] shrink-0 flex-col items-center rounded-md border px-3 py-2 text-sm transition
                    ${selected ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}
                    ${!works ? "cursor-not-allowed opacity-40" : ""}`}
                >
                  <span className="text-xs">{DAY_LABEL[d.getDay()]}</span>
                  <span className="text-lg font-semibold tabular-nums">{d.getDate()}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="trainerId" value={trainer.id} />
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="startTime" value={picked ?? ""} />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pick a time</CardTitle>
            <CardDescription>Each session is one hour.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-sm">Loading times…</p>
            ) : slots.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {trainer.name} does not train on this day.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((s) => (
                  <button
                    key={s.startTime}
                    type="button"
                    disabled={!s.available}
                    onClick={() => setPicked(s.startTime)}
                    title={s.reason === "booked" ? "Already booked" : s.reason === "past" ? "This time has passed" : undefined}
                    className={`flex items-center justify-center gap-1 rounded-md border px-2 py-2 text-sm tabular-nums transition
                      ${picked === s.startTime ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}
                      ${!s.available ? "cursor-not-allowed opacity-40 line-through" : ""}`}
                  >
                    {!s.available && <IconLock className="size-3" />}
                    {s.startTime}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-1.5 pt-6">
            <Label htmlFor="notes" className="text-xs">Anything your trainer should know? (optional)</Label>
            <Textarea
              id="notes"
              name="notes"
              maxLength={300}
              rows={2}
              placeholder="Goals for the session, an injury to work around, equipment you want to cover."
            />
          </CardContent>
        </Card>

        <Button type="submit" size="lg" disabled={!picked || submitting}>
          <IconCalendarPlus className="mr-2 size-4" />
          {submitting
            ? "Requesting…"
            : picked
              ? `Book ${date} at ${picked}`
              : "Pick a time to continue"}
        </Button>
      </form>
    </div>
  );
}
