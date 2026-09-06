import Link from "next/link";
import { IconArrowLeft, IconPlus } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { MemberBookings, type BookingRow } from "@/components/booking-lists";
import { GetMyBookings } from "@/action/booking.action";

export default async function MyBookingsPage() {
  const bookings = await GetMyBookings();

  const rows: BookingRow[] = bookings.map((b) => ({
    id: b.id,
    date: b.date,
    startTime: b.startTime,
    endTime: b.endTime,
    status: b.status,
    notes: b.notes,
    counterparty: b.trainer.name,
    counterpartyDetail: `₱${b.trainer.hourlyRate.toLocaleString()}/hr`,
  }));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <Link href="/member">
          <Button variant="ghost" size="sm" className="-ml-2">
            <IconArrowLeft className="mr-1 size-4" />
            Back
          </Button>
        </Link>
        <Link href="/member/trainers">
          <Button size="sm">
            <IconPlus className="mr-1 size-4" />
            Book a session
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">My bookings</h1>
        <p className="text-muted-foreground text-sm">
          Soonest first. A booking stays pending until your trainer confirms it.
        </p>
      </div>

      <MemberBookings bookings={rows} />
    </div>
  );
}
