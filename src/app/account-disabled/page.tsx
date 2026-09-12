import LogoutButton from "@/components/custom/LogoutButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Account deactivated" };

/**
 * Where a deactivated trainer lands if they were still signed in.
 *
 * It has to be its own public page: sending them to /login would bounce them
 * straight back to /trainer (middleware moves signed-in users off /login),
 * which denies them again — a redirect loop. From here they sign out.
 */
export default function AccountDisabledPage() {
  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-display text-2xl">This account has been deactivated</CardTitle>
          <CardDescription>
            Your CBG Fitness Center account can no longer sign in. If you think this is a mistake, please speak to the front desk.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LogoutButton className="w-fit" />
        </CardContent>
      </Card>
    </div>
  );
}
