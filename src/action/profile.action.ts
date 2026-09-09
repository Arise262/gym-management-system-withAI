"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { requireMemberId } from "@/lib/session";
import { normalizePhMobile } from "@/lib/phone";
import { toAppDate } from "@/lib/format";

/**
 * A member correcting their own details.
 *
 * Everything here is self-service: the member id comes from the signed session
 * via requireMemberId(), never from the form, so a member cannot edit anyone
 * else's record by changing a hidden input.
 *
 * Email is deliberately NOT editable. Member.email is a contact address, but
 * the login lives on User.email and notifications are sent to that one — so an
 * edit here would look like it changed where mail goes while actually changing
 * nothing. Changing a login is a separate concern with its own confirmation.
 */

export type DetailsResult = { success: boolean; error?: string; field?: string };

const detailsSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(80, "That name is too long."),
  phone: z.string().trim().min(1, "Enter your mobile number."),
  // The schema's Gender enum is lower-case.
  gender: z.enum(["male", "female", "other"], { message: "Choose an option." }),
  // Shape is checked by toAppDate() below, which accepts both dd-MM-yyyy and
  // the yyyy-MM-dd a native date input submits.
  DOB: z.string().trim().min(1, "Pick your date of birth."),
  address: z.string().trim().max(200, "That address is too long.").optional(),
});

export type MyDetails = {
  name: string;
  phone: string;
  gender: string;
  DOB: string;
  address: string;
  email: string;
  memberCode: string;
};

export async function GetMyDetails(): Promise<MyDetails> {
  const memberId = await requireMemberId();
  const m = await prisma.member.findUniqueOrThrow({
    where: { id: memberId },
    select: {
      name: true, phone: true, gender: true, DOB: true, address: true,
      memberCode: true, user: { select: { email: true } },
    },
  });

  return {
    name: m.name,
    // BigInt cannot cross into a client component - stringify at the boundary.
    phone: m.phone.toString(),
    gender: m.gender,
    // Members who registered before the DOB format was fixed have an ISO date
    // stored. Coerce on read so the date picker is never handed a value it
    // cannot parse — it throws "Invalid time value" and takes the page down.
    DOB: toAppDate(m.DOB) ?? "",
    address: m.address ?? "",
    email: m.user?.email ?? "",
    memberCode: m.memberCode,
  };
}

export async function SaveMyDetails(
  _prev: DetailsResult | null,
  formData: FormData
): Promise<DetailsResult> {
  const memberId = await requireMemberId();

  const parsed = detailsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { success: false, error: issue.message, field: String(issue.path[0] ?? "") };
  }

  const d = parsed.data;

  const dob = toAppDate(d.DOB);
  if (!dob) {
    return { success: false, field: "DOB", error: "Pick a valid date of birth." };
  }

  // Reject a malformed number instead of letting BigInt quietly truncate it.
  const phone = normalizePhMobile(d.phone);
  if (!phone) {
    return {
      success: false,
      field: "phone",
      error: "Enter a valid mobile number, for example 0917 123 4567.",
    };
  }

  await prisma.member.update({
    where: { id: memberId },
    data: {
      name: d.name,
      phone: BigInt(phone),
      gender: d.gender,
      DOB: dob,
      address: d.address?.trim() || null,
    },
  });

  // The member's name is shown on their home page and on the trainer's client
  // list, so both need to pick the change up.
  revalidatePath("/member");
  revalidatePath("/member/profile");

  return { success: true };
}
