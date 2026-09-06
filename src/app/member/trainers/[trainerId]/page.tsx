import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { IconArrowLeft } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { BookingPicker } from "@/components/booking-picker";
import { GetTrainerSlots, GetTrainers } from "@/action/booking.action";

/**
 * Opens on the trainer's next working day rather than always on today.
 *
 * Landing on a day the trainer does not work would show an empty slot list as
 * the first thing a member sees, which reads as "no availability" rather than
 * "wrong day".
 */
function firstWorkingDate(workingDays: Set<number>): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  for (let i = 0; i < 14; i++) {
    if (workingDays.has(d.getDay())) return d;
    d.setDate(d.getDate() + 1);
  }
  return new Date();
}

export default async function BookTrainerPage({
  params,
}: {
  params: Promise<{ trainerId: string }>;
}) {
  const { trainerId } = await params;

  const trainers = await GetTrainers();
  const trainer = trainers.find((t) => t.id === trainerId);
  if (!trainer) notFound();

  const workingDays = new Set(trainer.availability.map((a) => a.dayOfWeek));
  const date = format(firstWorkingDate(workingDays), "dd-MM-yyyy");
  const slots = await GetTrainerSlots(trainerId, date);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <Link href="/member/trainers">
        <Button variant="ghost" size="sm" className="-ml-2">
          <IconArrowLeft className="mr-1 size-4" />
          All trainers
        </Button>
      </Link>

      <BookingPicker
        trainer={{
          id: trainer.id,
          name: trainer.name,
          bio: trainer.bio,
          hourlyRate: trainer.hourlyRate,
          specializations: trainer.specializations,
          availability: trainer.availability,
        }}
        initialDate={date}
        initialSlots={slots?.slots ?? []}
      />
    </div>
  );
}
