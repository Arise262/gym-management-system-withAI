"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoginWithCredentials } from "@/action/auth.action";

/**
 * The card carries no title of its own. The page above it already says
 * "Welcome to CBG Fitness Center" as the h1, and a second "Login" heading
 * inches below it is a heading that earns nothing.
 */
export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
  const callbackUrl = useSearchParams().get("callbackUrl") ?? "";
  const [state, formAction, pending] = useActionState(LoginWithCredentials, null);

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-6">
            <input type="hidden" name="callbackUrl" value={callbackUrl} />

            <div className="grid gap-3">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="grid gap-3">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                required
              />
            </div>

            {state && !state.success && (
              <p role="alert" className="text-destructive text-sm font-medium">
                {state.error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
            </Button>

            <div className="text-center text-sm">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="underline underline-offset-4">
                Register
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
