"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ResetTrainerPassword, SetTrainerActive, type LoginDelivery } from "@/action/trainer-admin.action";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginNotice } from "./LoginNotice";

/** The login side of a trainer: password resets and deactivation. */
export function AccountPanel({
  trainerId,
  name,
  email,
  isActive,
  lastLogin,
  upcomingBookings,
}: {
  trainerId: string;
  name: string;
  email: string;
  isActive: boolean;
  lastLogin: string | null;
  upcomingBookings: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [login, setLogin] = useState<LoginDelivery>();

  async function resetPassword() {
    setBusy(true);
    const res = await ResetTrainerPassword(trainerId);
    setBusy(false);
    if (!res.success) return toast.error(res.error);
    setLogin(res.login);
    if (res.login.emailed) toast.success(`New password emailed to ${email}`);
  }

  async function setActive(active: boolean) {
    setBusy(true);
    const res = await SetTrainerActive(trainerId, active);
    setBusy(false);
    if (!res.success) return toast.error(res.error);
    toast.success(res.message);
    setLogin(undefined);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>
          Signs in as {email} · {isActive ? (lastLogin ? `last signed in ${lastLogin}` : "has not signed in yet") : "deactivated"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {login && <LoginNotice login={login} />}

        <div className="flex flex-wrap gap-2">
          {isActive && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={busy}>
                  Send new password
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Send {name} a new password?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Their current password stops working straight away. A new temporary one is emailed to {email}.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={resetPassword}>Send new password</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {isActive ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive" disabled={busy}>
                  Deactivate
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Deactivate {name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    They will be signed out and can no longer sign in, and members will stop seeing them. Their past sessions, plans and
                    messages are kept, and you can reactivate them later.
                    {upcomingBookings > 0 &&
                      ` They still have ${upcomingBookings} upcoming ${upcomingBookings === 1 ? "session" : "sessions"} booked — let those members know.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep active</AlertDialogCancel>
                  <AlertDialogAction onClick={() => setActive(false)}>Deactivate</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button onClick={() => setActive(true)} disabled={busy}>
              Reactivate
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
