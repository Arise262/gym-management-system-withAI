import { randomBytes } from "crypto";
import { isDeliverable, sendMail } from "@/lib/mail";
import { appOrigin } from "@/lib/notifications";

/**
 * Temporary passwords issued by the admin, for trainers and members alike.
 *
 * The admin never chooses one. A random password is generated and emailed
 * straight to the person — deliberately with sendMail, NOT notify(), because a
 * notification is stored as a row and shown in-app, and a password must not
 * sit in the database in plain text. Only when the email cannot go out (no
 * email set up, or a member whose login is a placeholder address) is it shown
 * to the admin, once, to hand over in person.
 */

/** How the temporary password reached the person. */
export type LoginDelivery = { emailed: true; email: string } | { emailed: false; email: string; tempPassword: string; reason: string };

/** 12 URL-safe random characters — about 72 bits, well past the 8-character rule. */
export function tempPassword(): string {
  return randomBytes(9).toString("base64url");
}

export async function deliverLogin(
  email: string,
  name: string,
  password: string,
  { isNew, audience }: { isNew: boolean; audience: "trainer" | "member" }
): Promise<LoginDelivery> {
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
      `Please change it after signing in — use Change password on your ${audience} page.`,
  });
  if (res.sent) return { emailed: true, email };
  return {
    emailed: false,
    email,
    tempPassword: password,
    reason: res.reason === "unconfigured" ? "Email is not set up on this server." : "The email could not be sent.",
  };
}
