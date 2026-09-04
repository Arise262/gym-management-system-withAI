import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

/** Reachable without a session. Everything else is denied by default. */
const PUBLIC_PREFIXES = ["/login", "/register", "/invoices"];

/** Where each role lands after login, and where it gets sent when it strays. */
const HOME_BY_ROLE = {
  ADMIN: "/dashboard",
  TRAINER: "/trainer",
  MEMBER: "/member",
} as const;

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const user = req.auth?.user;

  const isPublic = PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  // Signed-in users have no business on /login or /register.
  if (isPublic && user) {
    if (pathname.startsWith("/invoices")) return NextResponse.next();
    return NextResponse.redirect(new URL(HOME_BY_ROLE[user.role], req.nextUrl));
  }

  if (isPublic) return NextResponse.next();

  if (!user) {
    const login = new URL("/login", req.nextUrl);
    // Preserve where they were headed so login can bounce them back.
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }

  // Default-deny: anything not explicitly a member or trainer area is the
  // admin back office (/dashboard, /members, /sales, /attendance, ...).
  // A new page added later is therefore admin-only until someone says otherwise,
  // which is the safe direction for this to fail.
  const required: Role = pathname.startsWith("/member")
    ? "MEMBER"
    : pathname.startsWith("/trainer")
      ? "TRAINER"
      : "ADMIN";

  // ADMIN is a superset — it can reach every area for support and demos.
  const allowed = user.role === "ADMIN" || user.role === required;

  if (!allowed) {
    return NextResponse.redirect(new URL(HOME_BY_ROLE[user.role], req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Everything except:
     *  - /api/auth/*   (Auth.js internals)
     *  - /api/webhooks/* (PayMongo — authenticated by signature, not session)
     *  - /api/cron/*   (authenticated by CRON_SECRET header)
     *  - Next.js internals and static files
     */
    "/((?!api/auth|api/webhooks|api/cron|_next/static|_next/image|favicon.ico|fav.png|manifest.json|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)",
  ],
};
