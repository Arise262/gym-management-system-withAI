import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

const HOME_BY_ROLE = {
  ADMIN: "/dashboard",
  TRAINER: "/trainer",
  MEMBER: "/member",
} as const;

export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? HOME_BY_ROLE[user.role] : "/login");
}
