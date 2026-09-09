"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { BookingStatus } from "@prisma/client";
import { IconX, IconCheck, IconUserOff, IconFlag } from "@tabler/icons-react";
import { CancelBooking, SetBookingStatus } from "@/action/booking.action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAppDate } from "@/lib/format";

const STATUS_STYLE: Record<BookingStatus, string> = {
  PENDING: "bg-amber-400 text-black hover:bg-amber-400",
  CONFIRMED: "bg-emerald-600 text-white hover:bg-emerald-600",
  COMPLETED: "bg-slate-500 text-white hover:bg-slate-500",
  CANCELLED: "bg-muted text-muted-foreground hover:bg-muted",
  NO_SHOW: "bg-red-600 text-white hover:bg-red-600",
};

export type BookingRow = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  notes: string | null;
  /** Whoever the *other* party is, from the viewer's point of view. */
  counterparty: string;
  counterpartyDetail?: string;
};

/** A booking is over once it is completed, cancelled or marked a no-show. */
const CLOSED: BookingStatus[] = ["COMPLETED", "CANCELLED", "NO_SHOW"];

function Row({
  b,
  children,
}: {
  b: BookingRow;
  children?: React.ReactNode;
}) {
  return (
    <Card className={CLOSED.includes(b.status) ? "opacity-70" : undefined}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base tabular-nums">
              {formatAppDate(b.date) ?? b.date} · {b.startTime}–{b.endTime}
            </CardTitle>
            <CardDescription>
              {b.counterparty}
              {b.counterpartyDetail ? ` · ${b.counterpartyDetail}` : ""}
            </CardDescription>
          </div>
          <Badge className={STATUS_STYLE[b.status]}>{b.status.replace("_", " ")}</Badge>
        </div>
      </CardHeader>
      {(b.notes || children) && (
        <CardContent className="flex flex-col gap-3">
          {b.notes && <p className="text-muted-foreground text-sm italic">“{b.notes}”</p>}
          {children}
        </CardContent>
      )}
    </Card>
  );
}

/* ─────────────────────────────── member ─────────────────────────────── */

export function MemberBookings({ bookings }: { bookings: BookingRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function cancel(id: string) {
    setBusy(id);
    const res = await CancelBooking(id);
    setBusy(null);
    if (res.success) {
      toast.success("Booking cancelled");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  if (bookings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No bookings yet</CardTitle>
          <CardDescription>
            Book a one-hour session with a trainer and it will show up here.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {bookings.map((b) => (
        <Row key={b.id} b={b}>
          {!CLOSED.includes(b.status) && (
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              disabled={busy === b.id}
              onClick={() => cancel(b.id)}
            >
              <IconX className="mr-1 size-4" />
              {busy === b.id ? "Cancelling…" : "Cancel"}
            </Button>
          )}
        </Row>
      ))}
    </div>
  );
}

/* ─────────────────────────────── trainer ─────────────────────────────── */

export function TrainerSchedule({ bookings }: { bookings: BookingRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function setStatus(id: string, status: BookingStatus) {
    setBusy(id);
    const res = await SetBookingStatus(id, status);
    setBusy(null);
    if (res.success) {
      toast.success(`Marked ${status.toLowerCase().replace("_", " ")}`);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  if (bookings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nothing booked</CardTitle>
          <CardDescription>
            Sessions members book with you will appear here.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {bookings.map((b) => (
        <Row key={b.id} b={b}>
          {!CLOSED.includes(b.status) && (
            <div className="flex flex-wrap gap-2">
              {b.status === "PENDING" && (
                <Button size="sm" disabled={busy === b.id} onClick={() => setStatus(b.id, "CONFIRMED")}>
                  <IconCheck className="mr-1 size-4" />
                  Confirm
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                disabled={busy === b.id}
                onClick={() => setStatus(b.id, "COMPLETED")}
              >
                <IconFlag className="mr-1 size-4" />
                Completed
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy === b.id}
                onClick={() => setStatus(b.id, "NO_SHOW")}
              >
                <IconUserOff className="mr-1 size-4" />
                No show
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy === b.id}
                onClick={() => setStatus(b.id, "CANCELLED")}
              >
                <IconX className="mr-1 size-4" />
                Cancel
              </Button>
            </div>
          )}
        </Row>
      ))}
    </div>
  );
}
