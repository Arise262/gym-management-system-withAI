"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { hashPassword } from "@/lib/accounts";
import { isDeliverable, sendMail } from "@/lib/mail";
import { appOrigin } from "@/lib/notifications";
import { toMinutes } from "@/lib/booking-slots";
import { gymToday } from "@/lib/format";
import { parseGymDate } from "@/analytics/signals";

/**
 * Trainer management for the admin back office.
 *
 * Until this existed the only trainer was made by prisma/seed-demo.ts, so a
 * new hire needed a developer. A trainer is three rows: a User (the login,
 * role TRAINER), a Trainer profile (what members browse and book), and weekly
 * TrainerAvailability windows (what the booking slots are cut from).
 *
 * Passwords: the admin never chooses one. A random temporary password is
 * generated and emailed straight to the trainer — deliberately with sendMail,
 * NOT notify(), because a notification is stored as a row and shown in-app,
 * and a password must not sit in the database in plain text. Only when the
 * email cannot go out is it shown to the admin, once, to hand over in person.
 */

export type AvailabilityInput = { dayOfWeek: number; startTime: string; endTime: string };

export type TrainerInput = {
  name: string;
  email: string;
  bio: string;
  specializations: string[];
  certifications: string[];
  hourlyRate: number;
  isAvailable: boolean;
  availability: AvailabilityInput[];
};

export type TrainerFieldErrors = Partial<Record<"name" | "email" | "hourlyRate" | "availability", string>>;

export type TrainerSaveResult =
  | { success: true; trainerId: string; login?: LoginDelivery }
  | { success: false; error: string; fieldErrors?: TrainerFieldErrors };

/** How the temporary password reached the trainer. */
export type LoginDelivery = { emailed: true; email: string } | { emailed: false; email: string; tempPassword: string; reason: string };

export type AdminTrainer = {
  id: string;
  name: string;
  email: string;
  bio: string | null;
  specializations: string[];
  certifications: string[];
  hourlyRate: number;
  isAvailable: boolean;
  isActive: boolean;
  lastLoginAt: Date | null;
  availability: AvailabilityInput[];
  upcomingBookings: number;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ───────────────────────────── validation ───────────────────────────── */

function cleanList(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = String(v ?? "").trim().replace(/\s+/g, " ");
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      out.push(t);
    }
  }
  return out.slice(0, 20);
}

function validate(input: TrainerInput): { data: TrainerInput; fieldErrors: TrainerFieldErrors } {
  const fieldErrors: TrainerFieldErrors = {};
  const name = String(input.name ?? "").trim().replace(/\s+/g, " ");
  const email = String(input.email ?? "").trim().toLowerCase();
  const hourlyRate = Number(input.hourlyRate);

  if (!name) fieldErrors.name = "Enter the trainer's name.";
  else if (name.length > 80) fieldErrors.name = "Keep the name under 80 characters.";

  if (!EMAIL_RE.test(email)) fieldErrors.email = "Enter a valid email address.";

  if (!Number.isInteger(hourlyRate) || hourlyRate < 0) fieldErrors.hourlyRate = "Enter a whole number of pesos (0 or more).";

  const availability: AvailabilityInput[] = [];
  const days = new Set<number>();
  for (const w of input.availability ?? []) {
    const start = toMinutes(w.startTime);
    const end = toMinutes(w.endTime);
    if (!Number.isInteger(w.dayOfWeek) || w.dayOfWeek < 0 || w.dayOfWeek > 6 || start === null || end === null) {
      fieldErrors.availability = "One of the days has a time that could not be read.";
      continue;
    }
    // One booking is one hour (SLOT_MINUTES); a shorter window yields no slot.
    if (end - start < 60) {
      fieldErrors.availability = "Each working day needs at least one hour between start and finish.";
      continue;
    }
    if (days.has(w.dayOfWeek)) continue;
    days.add(w.dayOfWeek);
    availability.push({ dayOfWeek: w.dayOfWeek, startTime: w.startTime.trim(), endTime: w.endTime.trim() });
  }

  return {
    data: {
      name,
      email,
      bio: String(input.bio ?? "").trim().slice(0, 1000),
      specializations: cleanList(input.specializations ?? []),
      certifications: cleanList(input.certifications ?? []),
      hourlyRate,
      isAvailable: Boolean(input.isAvailable),
      availability,
    },
    fieldErrors,
  };
}

/* ───────────────────────────── passwords ───────────────────────────── */

/** 12 URL-safe random characters — about 72 bits, well past the 8-character rule. */
function tempPassword(): string {
  return randomBytes(9).toString("base64url");
}

async function deliverLogin(email: string, name: string, password: string, isNew: boolean): Promise<LoginDelivery> {
  if (!isDeliverable(email)) {
    return { emailed: false, email, tempPassword: password, reason: "That address cannot receive email." };
  }
  const first = name.split(" ")[0];
  const loginUrl = `${appOrigin()}/login`;
  const res = await sendMail({
    to: email,
    toName: name,
    subject: isNew ? "Your CBG Fitness Center trainer account" : "Your new CBG Fitness Center password",
    text:
      `Hi ${first},\n\n` +
      (isNew
        ? "An account has been set up for you as a trainer at CBG Fitness Center. Members can now see your profile and book sessions with you."
        : "The front desk has reset your CBG Fitness Center password.") +
      `\n\nSign in at ${loginUrl}\nEmail: ${email}\nTemporary password: ${password}\n\n` +
      "Please change it after signing in — use Change password on your trainer page.",
  });
  if (res.sent) return { emailed: true, email };
  return {
    emailed: false,
    email,
    tempPassword: password,
    reason: res.reason === "unconfigured" ? "Email is not set up on this server." : "The email could not be sent.",
  };
}

/* ───────────────────────────── reading ───────────────────────────── */

export async function GetAdminTrainers(): Promise<AdminTrainer[]> {
  await requireRole("ADMIN");
  const trainers = await prisma.trainer.findMany({
    orderBy: { name: "asc" },
    include: {
      user: { select: { email: true, isActive: true, lastLoginAt: true } },
      availability: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }], select: { dayOfWeek: true, startTime: true, endTime: true } },
      bookings: { where: { status: { in: ["PENDING", "CONFIRMED"] } }, select: { date: true } },
    },
  });

  // Booking dates are dd-MM-yyyy strings, so "upcoming" is decided here.
  const today = parseGymDate(gymToday())!.getTime();
  return trainers.map((t) => ({
    id: t.id,
    name: t.name,
    email: t.user.email,
    bio: t.bio,
    specializations: t.specializations,
    certifications: t.certifications,
    hourlyRate: t.hourlyRate,
    isAvailable: t.isAvailable,
    isActive: t.user.isActive,
    lastLoginAt: t.user.lastLoginAt,
    availability: t.availability,
    upcomingBookings: t.bookings.filter((b) => (parseGymDate(b.date)?.getTime() ?? 0) >= today).length,
  }));
}

export async function GetAdminTrainer(id: string): Promise<AdminTrainer | null> {
  const all = await GetAdminTrainers();
  return all.find((t) => t.id === id) ?? null;
}

/* ───────────────────────────── writing ───────────────────────────── */

export async function CreateTrainer(input: TrainerInput): Promise<TrainerSaveResult> {
  await requireRole("ADMIN");
  const { data, fieldErrors } = validate(input);
  if (Object.keys(fieldErrors).length > 0) return { success: false, error: "Check the highlighted fields.", fieldErrors };

  const taken = await prisma.user.findUnique({ where: { email: data.email }, select: { role: true } });
  if (taken) {
    return {
      success: false,
      error: "That email already has an account.",
      fieldErrors: { email: `Already used by a ${taken.role.toLowerCase()} account — each person signs in with their own email.` },
    };
  }

  const password = tempPassword();
  const passwordHash = await hashPassword(password);

  const trainer = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      role: "TRAINER",
      trainer: {
        create: {
          name: data.name,
          bio: data.bio || null,
          specializations: data.specializations,
          certifications: data.certifications,
          hourlyRate: data.hourlyRate,
          isAvailable: data.isAvailable,
          availability: { create: data.availability },
        },
      },
    },
    select: { trainer: { select: { id: true } } },
  });

  const login = await deliverLogin(data.email, data.name, password, true);
  revalidatePath("/trainers");
  return { success: true, trainerId: trainer.trainer!.id, login };
}

export async function UpdateTrainer(id: string, input: TrainerInput): Promise<TrainerSaveResult> {
  await requireRole("ADMIN");
  const { data, fieldErrors } = validate(input);
  if (Object.keys(fieldErrors).length > 0) return { success: false, error: "Check the highlighted fields.", fieldErrors };

  const current = await prisma.trainer.findUnique({ where: { id }, select: { userId: true, user: { select: { email: true } } } });
  if (!current) return { success: false, error: "That trainer no longer exists." };

  if (data.email !== current.user.email) {
    const taken = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } });
    if (taken) return { success: false, error: "That email already has an account.", fieldErrors: { email: "Already used by another account." } };
  }

  // Availability is replaced wholesale: the form shows the full week, so what
  // it sends IS the schedule. Existing bookings are separate rows and are not
  // touched — a trainer who drops Mondays keeps the Monday sessions already booked.
  await prisma.$transaction(
    [
      prisma.user.update({ where: { id: current.userId }, data: { email: data.email } }),
      prisma.trainer.update({
        where: { id },
        data: {
          name: data.name,
          bio: data.bio || null,
          specializations: data.specializations,
          certifications: data.certifications,
          hourlyRate: data.hourlyRate,
          isAvailable: data.isAvailable,
        },
      }),
      prisma.trainerAvailability.deleteMany({ where: { trainerId: id } }),
      prisma.trainerAvailability.createMany({ data: data.availability.map((w) => ({ ...w, trainerId: id })) }),
    ]
  );

  revalidatePath("/trainers");
  revalidatePath(`/trainers/${id}`);
  return { success: true, trainerId: id };
}

/** Issues a new temporary password — for a trainer who lost the first email or forgot theirs. */
export async function ResetTrainerPassword(id: string): Promise<{ success: true; login: LoginDelivery } | { success: false; error: string }> {
  await requireRole("ADMIN");
  const trainer = await prisma.trainer.findUnique({ where: { id }, select: { name: true, userId: true, user: { select: { email: true, isActive: true } } } });
  if (!trainer) return { success: false, error: "That trainer no longer exists." };
  if (!trainer.user.isActive) return { success: false, error: "Reactivate the account before sending a new password." };

  const password = tempPassword();
  await prisma.user.update({ where: { id: trainer.userId }, data: { passwordHash: await hashPassword(password) } });
  return { success: true, login: await deliverLogin(trainer.user.email, trainer.name, password, false) };
}

/**
 * Deactivate: the login stops working (checked on every trainer request, not
 * just at sign-in — see requireRole) and members can no longer book them.
 * Nothing is deleted, so past sessions, plans and messages keep their trainer.
 */
export async function SetTrainerActive(id: string, active: boolean): Promise<{ success: true; message: string } | { success: false; error: string }> {
  await requireRole("ADMIN");
  const trainer = await prisma.trainer.findUnique({ where: { id }, select: { name: true, userId: true } });
  if (!trainer) return { success: false, error: "That trainer no longer exists." };

  await prisma.$transaction([
    prisma.user.update({ where: { id: trainer.userId }, data: { isActive: active } }),
    prisma.trainer.update({ where: { id }, data: { isAvailable: active } }),
  ]);

  revalidatePath("/trainers");
  revalidatePath(`/trainers/${id}`);
  return {
    success: true,
    message: active ? `${trainer.name} can sign in and be booked again.` : `${trainer.name} is deactivated — they can no longer sign in or be booked.`,
  };
}
