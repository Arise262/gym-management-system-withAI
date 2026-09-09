import Image from "next/image";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export default function Page() {
  return (
    <div className="bg-surface flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-8">
        {/* The shield is the first thing anyone sees, so it carries the
            introduction and the form below is just a form. Two files rather
            than one because the mark needs its own treatment on each ground —
            the same pair the sidebar uses.

            alt="" on both: the heading directly beneath already says the gym's
            name, and a screen reader announcing it twice is noise, not
            information. */}
        <div className="flex flex-col items-center gap-4 text-center">
          <Image
            src="/logo.png"
            width={84}
            height={81}
            priority
            alt=""
            className="dark:hidden"
          />
          <Image
            src="/logo-light.png"
            width={84}
            height={81}
            priority
            alt=""
            className="hidden dark:block"
          />
          <div className="space-y-1.5">
            <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance">
              Welcome to CBG Fitness Center
            </h1>
            <p className="text-muted-foreground text-sm">
              Sign in to your account to continue.
            </p>
          </div>
        </div>

        {/* useSearchParams() in LoginForm requires a Suspense boundary. */}
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
