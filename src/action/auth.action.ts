"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { format } from "date-fns";
import { AuthError } from "next-auth";
import prisma from "@/lib/prisma";
import { signIn, signOut, BCRYPT_ROUNDS } from "@/lib/auth";
import { requireUser } from "@/lib/session";
import { generateUniqueMemberCode } from "@/action/member.action";

export type ActionResult = { success: true } | { success: false; error: string };

/* ------------------------------------------------------------------ login */

export async function LoginWithCredentials(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "");

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: callbackUrl || "/",
    });
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: "Incorrect email or password." };
    }
    // signIn throws a NEXT_REDIRECT on success — it must bubble up.
    throw error;
  }
}

export async function Logout() {
  await signOut({ redirectTo: "/login" });
}

/* ----------------------------------------------------------- registration */

const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Please enter your full name."),
    email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    phone: z
      .string()
      .trim()
      .regex(/^\d{10,15}$/, "Enter a valid phone number (digits only)."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string(),
    gender: z.enum(["male", "female", "other"]),
    DOB: z.string().min(1, "Date of birth is required."),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

/**
 * Member self-registration. Creates the User (identity) and Member (profile)
 * in one transaction so a half-registered account can never exist.
 */
export async function RegisterMember(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const { name, email, phone, password, gender, DOB } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { success: false, error: "An account with that email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const memberCode = await generateUniqueMemberCode();

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, passwordHash, role: "MEMBER" },
      });
      await tx.member.create({
        data: {
          userId: user.id,
          name,
          email,
          memberCode,
          phone: BigInt(phone),
          gender,
          DOB,
          DOJ: format(new Date(), "dd-MM-yyyy"),
        },
      });
    });
  } catch {
    return { success: false, error: "Could not create your account. Please try again." };
  }

  return { success: true };
}

/* -------------------------------------------------------- password change */

const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, "Enter your current password."),
    newPassword: z.string().min(8, "New password must be at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "New passwords do not match.",
    path: ["confirmPassword"],
  });

/**
 * Changes the signed-in user's password.
 *
 * The account is taken from the session, never from a client-supplied id —
 * otherwise anyone could reset anyone else's password by posting a different id.
 */
export async function ChangePassword(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!record) return { success: false, error: "Account not found." };

  const ok = await bcrypt.compare(parsed.data.oldPassword, record.passwordHash);
  if (!ok) return { success: false, error: "Your current password is incorrect." };

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, BCRYPT_ROUNDS) },
  });

  return { success: true };
}
