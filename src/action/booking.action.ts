"use server";

import { revalidatePath } from "next/cache";
import { addMinutes, format, isValid, parse } from "date-fns";
import { Prisma, type BookingStatus } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireMemberId, requireRole, requireUser } from "@/lib/session";
import { SLOT_MINUTES, slotsForDate, toMinutes, type Slot } from "@/lib/booking-slots";
import { notifyMember, notifyTrainer } from "@/lib/notifications";

/**
 * Personal-training bookings.
 *
 * One booking is one hour with one trainer. The schema enforces
 * @@unique([trainerId, date, startTime]), so two members racing for the same
 * slot cannot both win — the loser gets a constraint violation, which is
 * translated below into a readable message rather than a 500.
 */

const DATE_FMT = "dd-MM-yyyy";

export type BookingActionResult =
  | { success: true; bookingId: string }
  | { success: false; error: string };

/** Parses the "dd-MM-yyyy" strings this app stores dates as. */
function parseGymDate(value: string): Date | null {
  const d = parse(value, DATE_FMT, new Date());
  return isValid(d) ? d : null;
}

/** The Trainer row for the signed-in trainer, or null for anyone else. */
async function currentTrainerId(): Promise<string | null> {
  const user = await requireUser();
  const trainer = await prisma.trainer.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  return trainer?.id ?? null;
}

/* ─────────────────────────────── browsing ─────────────────────────────── */

/** Bookable trainers, with enough detail for the member to choose one. */
export async function GetTrainers() {
  await requireUser();

  return prisma.trainer.findMany({
    where: { isAvailable: true },
    orderBy: { name: "asc" },
    include: {
      availability: {
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        select: { dayOfWeek: true, startTime: true, endTime: true },
      },
    },
  });
}

export type TrainerSlots = {
  trainer: { id: string; name: string; bio: string | null; hourlyRate: number; specializations: string[] };
  date: string;
  slots: Slot[];
};

/**
 * A trainer's slots for one date.
 *
 * Slots are computed here, on the server, and the booking action recomputes
 * them before writing. The client is never trusted to say a slot exists — it
 * only says which one it wants.
 */
export async function GetTrainerSlots(
  trainerId: string,
  dateStr: string
): Promise<TrainerSlots | null> {
  await requireUser();

  const date = parseGymDate(dateStr);
  if (!date) return null;

  const trainer = await prisma.trainer.findFirst({
    where: { id: trainerId, isAvailable: true },
    include: {
      availability: { select: { dayOfWeek: true, startTime: true, endTime: true } },
    },
  });
  if (!trainer) return null;

  // CANCELLED bookings do not hold a slot — see CreateBooking for how the row
  // is reused rather than blocking the time forever.
  const taken = await prisma.booking.findMany({
    where: { trainerId, date: dateStr, status: { not: "CANCELLED" } },
    select: { startTime: true },
  });

  return {
    trainer: {
      id: trainer.id,
      name: trainer.name,
      bio: trainer.bio,
      hourlyRate: trainer.hourlyRate,
      specializations: trainer.specializations,
    },
    date: dateStr,
    slots: slotsForDate(
      trainer.availability,
      date,
      taken.map((t) => t.startTime),
      new Date()
    ),
  };
}

/* ─────────────────────────────── booking ─────────────────────────────── */

const createSchema = z.object({
  trainerId: z.string().uuid(),
  date: z.string().regex(/^\d{2}-\d{2}-\d{4}$/, "Pick a valid date."),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Pick a valid time."),
  notes: z.string().trim().max(300).optional(),
});

export async function CreateBooking(
  _prev: BookingActionResult | null,
  formData: FormData
): Promise<BookingActionResult> {
  const memberId = await requireMemberId();

  const parsed = createSchema.safeParse({
    trainerId: formData.get("trainerId"),
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const { trainerId, date: dateStr, startTime, notes } = parsed.data;

  // Recompute the slot server-side. The form could name any time at all; only
  // a slot the trainer actually offers, on a day they work, may be booked.
  const offered = await GetTrainerSlots(trainerId, dateStr);
  if (!offered) return { success: false, error: "That trainer is not taking bookings." };

  const slot = offered.slots.find((s) => s.startTime === startTime);
  if (!slot) return { success: false, error: "That trainer does not work at that time." };
  if (slot.reason === "past") return { success: false, error: "That time has already passed." };
  if (!slot.available) return { success: false, error: "That slot has just been taken." };

  const startMin = toMinutes(startTime)!;
  const endTime = format(addMinutes(new Date(0, 0, 1, 0, 0), startMin + SLOT_MINUTES), "HH:mm");

  try {
    // A CANCELLED booking still occupies the unique key, so re-book by taking
    // that row over. Deleting it instead would lose the record that the slot
    // was once booked and dropped, which is exactly what a no-show pattern
    // looks like.
    const dead = await prisma.booking.findFirst({
      where: { trainerId, date: dateStr, startTime, status: "CANCELLED" },
      select: { id: true },
    });

    const booking = dead
      ? await prisma.booking.update({
          where: { id: dead.id },
          data: { memberId, endTime, notes, status: "PENDING" },
        })
      : await prisma.booking.create({
          data: { memberId, trainerId, date: dateStr, startTime, endTime, notes, status: "PENDING" },
        });

    // Tell the trainer. notify() never throws, so a mail outage cannot undo a
    // booking that has already been written.
    const member = await prisma.member.findUnique({ where: { id: memberId }, select: { name: true } });
    await notifyTrainer(trainerId, {
      type: "BOOKING_REQUESTED",
      title: `${member?.name ?? "A member"} requested ${dateStr} at ${startTime}`,
      body:
        `${member?.name ?? "A member"} asked for a session on ${dateStr} from ${startTime} to ${endTime}.` +
        (notes ? ` Note: "${notes}".` : "") +
        " Confirm it from your schedule.",
      channel: "BOTH",
      actionUrl: "/trainer",
      metadata: { bookingId: booking.id },
      dedupeKey: `booking-requested:${booking.id}:${booking.updatedAt.getTime()}`,
    });

    revalidatePath("/member/bookings");
    revalidatePath("/trainer");
    return { success: true, bookingId: booking.id };
  } catch (e) {
    // P2002 is the unique constraint doing its job: someone else booked this
    // slot between the check above and the write.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { success: false, error: "Someone just booked that slot. Please pick another." };
    }
    console.error("CreateBooking failed:", e);
    return { success: false, error: "Could not create that booking. Please try again." };
  }
}

/* ─────────────────────────────── reading ─────────────────────────────── */

/** The signed-in member's bookings, soonest first. */
export async function GetMyBookings() {
  const memberId = await requireMemberId();

  const bookings = await prisma.booking.findMany({
    where: { memberId },
    include: { trainer: { select: { id: true, name: true, hourlyRate: true } } },
  });

  return sortByWhen(bookings);
}

/** The signed-in trainer's bookings, soonest first. */
export async function GetTrainerBookings() {
  await requireRole("TRAINER");
  const trainerId = await currentTrainerId();
  if (!trainerId) return [];

  const bookings = await prisma.booking.findMany({
    where: { trainerId },
    include: { member: { select: { id: true, name: true, memberCode: true, phone: true } } },
  });

  return sortByWhen(bookings);
}

/**
 * Chronological order.
 *
 * Sorting happens here rather than in SQL because `date` is a "dd-MM-yyyy"
 * string: ordering it in the database sorts by day-of-month first, putting the
 * 1st of next month before the 2nd of this one.
 */
function sortByWhen<T extends { date: string; startTime: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const da = parseGymDate(a.date)?.getTime() ?? 0;
    const db = parseGymDate(b.date)?.getTime() ?? 0;
    return da - db || a.startTime.localeCompare(b.startTime);
  });
}

/* ────────────────────────── status transitions ────────────────────────── */

/**
 * Cancels a booking.
 *
 * Both sides may cancel — the member because plans change, the trainer because
 * they cannot make it — so this checks that the caller owns one end of it
 * rather than requiring a particular role.
 */
export async function CancelBooking(bookingId: string): Promise<BookingActionResult> {
  const user = await requireUser();

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      memberId: true,
      trainerId: true,
      status: true,
      date: true,
      startTime: true,
      member: { select: { name: true } },
      trainer: { select: { name: true } },
    },
  });
  if (!booking) return { success: false, error: "That booking no longer exists." };

  const trainerId = await currentTrainerId();
  const isOwner = booking.memberId === user.memberId || booking.trainerId === trainerId;
  if (!isOwner && user.role !== "ADMIN") {
    return { success: false, error: "That booking is not yours to cancel." };
  }

  if (booking.status === "COMPLETED") {
    return { success: false, error: "That session already happened." };
  }

  await prisma.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });

  // Tell the other side. A member cancelling informs the trainer; a trainer
  // (or admin) cancelling informs the member.
  const when = `${booking.date} at ${booking.startTime}`;
  if (booking.memberId === user.memberId) {
    await notifyTrainer(booking.trainerId, {
      type: "BOOKING_CANCELLED",
      title: `${booking.member.name} cancelled ${when}`,
      body: `${booking.member.name} cancelled their session on ${when}. The slot is open again.`,
      channel: "BOTH",
      actionUrl: "/trainer",
      metadata: { bookingId: booking.id },
    });
  } else {
    await notifyMember(booking.memberId, {
      type: "BOOKING_CANCELLED",
      title: `Your session on ${when} was cancelled`,
      body: `${booking.trainer.name} had to cancel your session on ${when}. Sorry about that — you can pick another slot from the trainers page.`,
      channel: "BOTH",
      actionUrl: "/member/trainers",
      metadata: { bookingId: booking.id },
    });
  }

  revalidatePath("/member/bookings");
  revalidatePath("/trainer");
  return { success: true, bookingId: booking.id };
}

/** Statuses a trainer may set. Members can only cancel. */
const TRAINER_SETTABLE: BookingStatus[] = ["CONFIRMED", "COMPLETED", "NO_SHOW", "CANCELLED"];

export async function SetBookingStatus(
  bookingId: string,
  status: BookingStatus
): Promise<BookingActionResult> {
  await requireRole("TRAINER");
  const trainerId = await currentTrainerId();

  if (!TRAINER_SETTABLE.includes(status)) {
    return { success: false, error: "That is not a status you can set." };
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      trainerId: true,
      memberId: true,
      status: true,
      date: true,
      startTime: true,
      endTime: true,
      trainer: { select: { name: true } },
    },
  });
  if (!booking) return { success: false, error: "That booking no longer exists." };

  const user = await requireUser();
  if (booking.trainerId !== trainerId && user.role !== "ADMIN") {
    return { success: false, error: "That booking is not on your schedule." };
  }

  await prisma.booking.update({ where: { id: booking.id }, data: { status } });

  const when = `${booking.date} at ${booking.startTime}`;
  if (status === "CONFIRMED" && booking.status !== "CONFIRMED") {
    await notifyMember(booking.memberId, {
      type: "BOOKING_CONFIRMED",
      title: `Session confirmed: ${when}`,
      body: `${booking.trainer.name} confirmed your session on ${booking.date}, ${booking.startTime}–${booking.endTime}. See you there.`,
      channel: "BOTH",
      actionUrl: "/member/bookings",
      metadata: { bookingId: booking.id },
    });
  } else if (status === "CANCELLED" && booking.status !== "CANCELLED") {
    await notifyMember(booking.memberId, {
      type: "BOOKING_CANCELLED",
      title: `Your session on ${when} was cancelled`,
      body: `${booking.trainer.name} had to cancel your session on ${when}. Sorry about that — you can pick another slot from the trainers page.`,
      channel: "BOTH",
      actionUrl: "/member/trainers",
      metadata: { bookingId: booking.id },
    });
  }

  revalidatePath("/trainer");
  revalidatePath("/member/bookings");
  return { success: true, bookingId: booking.id };
}
