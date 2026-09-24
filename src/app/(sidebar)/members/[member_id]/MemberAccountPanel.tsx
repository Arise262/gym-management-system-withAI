"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DeleteMember, GetMemberAccount, ResetMemberPassword, type MemberAccount } from "@/action/member-admin.action";
import type { LoginDelivery } from "@/lib/login-delivery";
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
import { formatAppDate, gymToday, pesos } from "@/lib/format";
import { LoginNotice } from "../../trainers/_components/LoginNotice";

/** The login side of a member: password resets and deletion. */
export function MemberAccountPanel({ memberId, name }: { memberId: string; name: string }) {
  const router = useRouter();
  const [account, setAccount] = useState<MemberAccount | null>();
  const [busy, setBusy] = useState(false);
  const [login, setLogin] = useState<LoginDelivery>();

  useEffect(() => {
    GetMemberAccount(memberId).then(setAccount);
  }, [memberId]);

  async function resetPassword() {
    setBusy(true);
    const res = await ResetMemberPassword(memberId);
    setBusy(false);
    if (!res.success) return toast.error(res.error);
    setLogin(res.login);
    if (res.login.emailed) toast.success(`New password emailed to ${res.login.email}`);
  }

  async function deleteMember() {
    setBusy(true);
    const res = await DeleteMember(memberId);
    if (!res.success) {
      setBusy(false);
      return toast.error(res.error);
    }
    toast.success(res.message);
    router.push("/members");
  }

  if (!account) return null;

  const lastLogin = account.lastLoginAt ? formatAppDate(gymToday(account.lastLoginAt)) : null;
  const history = [
    account.payments > 0 && `${account.payments} ${account.payments === 1 ? "payment" : "payments"} (${pesos(account.totalPaid)})`,
    account.visits > 0 && `${account.visits} attendance ${account.visits === 1 ? "record" : "records"}`,
  ].filter(Boolean);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>
          {account.email
            ? `Signs in as ${account.email} · ${lastLogin ? `last signed in ${lastLogin}` : "has not signed in yet"}`
            : "This member has no login account."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {login && <LoginNotice login={login} who="member" />}

        <div className="flex flex-wrap gap-2">
          {account.email && (
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
                    Their current password stops working straight away. A new temporary one is emailed to {account.email} — or, if that
                    address cannot receive email, shown here once for you to hand over.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={resetPassword}>Send new password</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-destructive" disabled={busy}>
                Delete member
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {name} permanently?</AlertDialogTitle>
                <AlertDialogDescription>
                  Their login and everything recorded about them — plans, bookings, messages
                  {history.length > 0 ? `, and ${history.join(" and ")}` : ""} — are removed. This cannot be undone.
                  {account.payments > 0 && " Their payments will no longer count in the revenue reports."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep member</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={deleteMember}>
                  Delete permanently
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
